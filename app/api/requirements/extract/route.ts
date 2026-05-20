import { generateObject } from "ai";
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

function toTranscript(messages: VisibleMessage[]): string {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-18)
    .map((message) => `${message.role === "user" ? "Customer" : "Analyst"}: ${message.content}`)
    .join("\n");
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
    const result = await generateObject({
      model: getLanguageModel(),
      mode: "json",
      schema: extractionUpdateSchema,
      schemaName: "RequirementExtractionUpdate",
      schemaDescription:
        "A strict update for the hidden B2B SaaS requirement table extracted from the customer conversation.",
      temperature: 0,
      prompt: buildExtractionPrompt({ transcript, currentState })
    });

    const update = extractionUpdateSchema.parse(result.object);
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
    }).catch((error) => {
      console.error("Failed to persist requirement session", error);
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
    console.error("AI extraction failed", {
      sessionId: parsed.data.sessionId,
      message
    });

    return Response.json(
      {
        error: "AI extraction failed.",
        details: message
      },
      { status: 500 }
    );
  }
}
