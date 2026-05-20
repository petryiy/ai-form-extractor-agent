import { generateObject, generateText, type RepairTextFunction } from "ai";
import { buildExtractionPrompt } from "@/lib/ai/prompts";
import { getLanguageModel, hasAiConfig } from "@/lib/ai/provider";
import {
  extractRequestSchema,
  extractionUpdateSchema,
  type VisibleMessage
} from "@/lib/requirements/contracts";
import {
  buildFallbackQuestion,
  calculateCompleteness,
  diffRequirementStates,
  getMissingCriteria,
  mergeRequirementPatch
} from "@/lib/requirements/state";
import { notifyRequirementWebhook } from "@/lib/server/requirement-webhook";
import { saveRequirementSession } from "@/lib/server/session-store";

export const runtime = "nodejs";
export const maxDuration = 30;

const extractionJsonShape = `{
  "patch": {},
  "nextQuestion": "string or null",
  "customerIntent": "provide_requirements | change_previous_answer | off_topic | not_sure | done",
  "evidence": [{ "field": "one requirement field key", "quote": "short supporting quote" }],
  "confidence": 0.0,
  "notes": []
}`;

function toTranscript(messages: VisibleMessage[]): string {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-18)
    .map((message) => `${message.role === "user" ? "Customer" : "Analyst"}: ${message.content}`)
    .join("\n");
}

const repairExtractionJson: RepairTextFunction = async ({ text, error }) => {
  const repairResult = await generateText({
    model: getLanguageModel(),
    temperature: 0,
    prompt: `Repair this malformed or schema-invalid JSON so it becomes one valid JSON object only.

Target shape:
${extractionJsonShape}

Rules:
- Return JSON only. No markdown.
- Preserve all supported values from the broken JSON.
- If a value is incomplete or unsupported, omit it from patch.
- If unsure, use an empty patch, null nextQuestion, confidence 0, and a note.

Parser/validation error:
${error.message}

Broken JSON/text:
${text}`
  });

  const repaired = repairResult.text.trim();

  if (!repaired.startsWith("{")) {
    return null;
  }

  return repaired;
};

async function generateExtractionUpdate({
  transcript,
  currentState
}: {
  transcript: string;
  currentState: typeof extractRequestSchema._type.currentState;
}) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await generateObject({
        model: getLanguageModel(),
        mode: "json",
        schema: extractionUpdateSchema,
        schemaName: "RequirementExtractionUpdate",
        schemaDescription:
          "A strict update for the hidden B2B SaaS requirement table extracted from the customer conversation.",
        temperature: 0,
        maxTokens: 1400,
        prompt: buildExtractionPrompt({ transcript, currentState }),
        experimental_repairText: repairExtractionJson
      });

      return extractionUpdateSchema.parse(result.object);
    } catch (error) {
      lastError = error;
      console.warn("AI extraction attempt failed", {
        attempt,
        message: error instanceof Error ? error.message : "Unknown extraction attempt failure."
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown extraction failure.");
}

export async function POST(request: Request) {
  if (!hasAiConfig()) {
    return Response.json(
      {
        error: "Missing DEEPSEEK_API_KEY. Add it to .env.local before using AI extraction."
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = extractRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid extraction request.",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const { currentState, messages } = parsed.data;
  const transcript = toTranscript(messages);

  try {
    const update = await generateExtractionUpdate({ transcript, currentState });
    const nextState = mergeRequirementPatch(currentState, update.patch);
    const missing = getMissingCriteria(nextState);
    const fallbackQuestion = buildFallbackQuestion(nextState);
    const changes = diffRequirementStates(currentState, nextState);

    const responsePayload = {
      state: nextState,
      completeness: calculateCompleteness(nextState),
      missing: missing.map((criterion) => ({
        key: criterion.key,
        label: criterion.label,
        question: criterion.question,
        required: criterion.required
      })),
      nextQuestion: update.nextQuestion ?? fallbackQuestion,
      changes,
      evidence: update.evidence,
      customerIntent: update.customerIntent,
      confidence: update.confidence,
      notes: update.notes,
      updatedAt: new Date().toISOString()
    };

    await saveRequirementSession({
      sessionId: parsed.data.sessionId,
      state: nextState,
      messages,
      extraction: responsePayload
    });

    await notifyRequirementWebhook({
      sessionId: parsed.data.sessionId,
      state: nextState,
      messages,
      extraction: responsePayload
    }).catch((error) => {
      console.error("Failed to notify requirement webhook", error);
    });

    return Response.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction failure.";
    const missing = getMissingCriteria(currentState);
    const fallbackQuestion = buildFallbackQuestion(currentState);
    console.error("AI extraction failed", {
      sessionId: parsed.data.sessionId,
      message
    });

    return Response.json({
      state: currentState,
      completeness: calculateCompleteness(currentState),
      missing: missing.map((criterion) => ({
        key: criterion.key,
        label: criterion.label,
        question: criterion.question,
        required: criterion.required
      })),
      nextQuestion: fallbackQuestion,
      changes: [],
      evidence: [],
      customerIntent: "not_sure",
      confidence: 0,
      notes: [`Extraction skipped after model JSON failure: ${message}`],
      updatedAt: new Date().toISOString()
    });
  }
}
