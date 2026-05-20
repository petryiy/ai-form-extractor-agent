import { buildExtractionPrompt } from "@/lib/ai/prompts";
import { getAiApiConfig, hasAiConfig } from "@/lib/ai/provider";
import {
  extractRequestSchema,
  extractionUpdateSchema,
  type VisibleMessage
} from "@/lib/requirements/contracts";
import type { RequirementState } from "@/lib/requirements/schema";
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

async function generateExtractionUpdate({
  transcript,
  currentState
}: {
  transcript: string;
  currentState: RequirementState;
}) {
  let lastError: unknown;
  const config = getAiApiConfig();

  if (!config.apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY.");
  }

  const prompt = `${buildExtractionPrompt({ transcript, currentState })}

Return exactly this JSON shape. Do not stream, do not use markdown, and do not add any text outside JSON:
${extractionJsonShape}`;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(`${config.baseURL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: {
            type: "json_object"
          },
          thinking: {
            type: "disabled"
          },
          temperature: 0,
          max_tokens: 1400
        })
      });

      const raw = await response.text();

      if (!response.ok) {
        throw new Error(`DeepSeek extraction request failed (${response.status}): ${raw}`);
      }

      const completion = JSON.parse(raw) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const content = completion.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("DeepSeek extraction returned an empty message.");
      }

      const object = JSON.parse(stripJsonFence(content));
      return extractionUpdateSchema.parse(object);
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

function stripJsonFence(text: string) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
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
