import { buildExtractionPrompt } from "@/lib/ai/prompts";
import { getAiApiConfig, hasAiConfig } from "@/lib/ai/provider";
import {
  extractResponseSchema,
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
  "patch": {
    "industry": "education",
    "corePainPoints": ["teachers spend too much time preparing lessons"],
    "timeline": "before next semester"
  },
  "nextQuestion": "string or null",
  "customerIntent": "provide_requirements | change_previous_answer | off_topic | not_sure | done",
  "evidence": [{ "field": "one requirement field key", "quote": "short supporting quote" }],
  "confidence": 0.0,
  "notes": []
}`;

const patchFieldGuide = `Allowed patch keys and value types:
- industry: string
- companySize: string
- corePainPoints: string[]
- compellingEvent: string
- currentWorkflow: string
- specificWorkflow: string
- targetUsers: string[]
- authority: string
- alternativeSolution: string
- platformPreference: string[]
- mustHaveFeatures: string[]
- niceToHaveFeatures: string[]
- budgetRange: string
- timeline: string
- successMetrics: string[]
- integrations: string[]
- stakeholders: string[]
- constraints: string[]
- dataSensitivity: "low" | "medium" | "high" | "regulated" | "unknown"
- decisionProcess: string
- additionalContext: string`;

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

Return one JSON object using this envelope. The patch values shown here are examples, not default values. Omit every patch key that is not directly supported by the customer transcript. Do not return an empty patch when the customer has provided concrete requirement information. Do not stream, do not use markdown, and do not add any text outside JSON:
${extractionJsonShape}

${patchFieldGuide}`;

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
              role: "system",
              content:
                "You extract B2B SaaS requirements into strict JSON. Return JSON only. Never wrap the JSON in markdown."
            },
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
          max_tokens: 3000
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

      const object = parseJsonObjectFromText(content);
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

function parseJsonObjectFromText(text: string) {
  const stripped = stripJsonFence(text);

  try {
    return JSON.parse(stripped);
  } catch {
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error(`DeepSeek extraction did not return a JSON object: ${stripped.slice(0, 240)}`);
    }

    return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
  }
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

  const update = await generateExtractionUpdate({ transcript, currentState }).catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown extraction failure.";
    console.error("AI extraction failed", {
      sessionId: parsed.data.sessionId,
      message
    });

    return {
      errorMessage: message
    };
  });

  const hasExtraction = "patch" in update;
  const nextState = hasExtraction ? mergeRequirementPatch(currentState, update.patch) : currentState;
  const missing = getMissingCriteria(nextState);
  const fallbackQuestion = buildFallbackQuestion(nextState);
  const changes = diffRequirementStates(currentState, nextState);
  const responsePayload = extractResponseSchema.parse({
    state: nextState,
    completeness: calculateCompleteness(nextState),
    missing: missing.map((criterion) => ({
      key: criterion.key,
      label: criterion.label,
      question: criterion.question,
      required: criterion.required
    })),
    nextQuestion: hasExtraction ? update.nextQuestion ?? fallbackQuestion : fallbackQuestion,
    changes,
    evidence: hasExtraction ? update.evidence : [],
    customerIntent: hasExtraction ? update.customerIntent : "not_sure",
    confidence: hasExtraction ? update.confidence : 0,
    notes: hasExtraction
      ? update.notes
      : [`Extraction skipped after model JSON failure: ${update.errorMessage}`],
    updatedAt: new Date().toISOString()
  });

  try {
    await saveRequirementSession({
      sessionId: parsed.data.sessionId,
      state: nextState,
      messages,
      extraction: responsePayload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage failure.";
    console.error("Requirement report save failed", {
      sessionId: parsed.data.sessionId,
      message
    });

    return Response.json(
      {
        error: "Requirement report save failed.",
        details: message
      },
      { status: 500 }
    );
  }

  await notifyRequirementWebhook({
    sessionId: parsed.data.sessionId,
    state: nextState,
    messages,
    extraction: responsePayload
  }).catch((error) => {
    console.error("Failed to notify requirement webhook", error);
  });

  return Response.json(responsePayload);
}
