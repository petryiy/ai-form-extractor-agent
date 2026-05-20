import { streamText, type CoreMessage } from "ai";
import { z } from "zod";
import { buildAnalystSystemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel, hasAiConfig } from "@/lib/ai/provider";
import { requirementStateSchema } from "@/lib/requirements/schema";

export const runtime = "nodejs";
export const maxDuration = 30;

const chatRequestSchema = z.object({
  messages: z.array(
    z
      .object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(12000)
      })
      .passthrough()
  ),
  requirementState: requirementStateSchema,
  suggestedNextQuestion: z.string().nullable().optional()
});

export async function POST(request: Request) {
  if (!hasAiConfig()) {
    return new Response("Missing DEEPSEEK_API_KEY. Add it to .env.local before chatting.", {
      status: 500
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid chat request.",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const { messages, requirementState, suggestedNextQuestion } = parsed.data;
  const modelMessages: CoreMessage[] = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content
    }));

  try {
    const result = await streamText({
      model: getLanguageModel(),
      temperature: 0.35,
      system: buildAnalystSystemPrompt({
        currentState: requirementState,
        suggestedNextQuestion: suggestedNextQuestion ?? null
      }),
      messages: modelMessages
    });

    return result.toDataStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown chat failure.";
    console.error("AI chat failed", { message });

    return new Response("AI chat failed. Check server logs for details.", {
      status: 500
    });
  }
}
