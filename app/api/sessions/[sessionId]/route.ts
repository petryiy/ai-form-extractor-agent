import { z } from "zod";
import { getRequirementSession } from "@/lib/server/session-store";

export const runtime = "nodejs";

const paramsSchema = z.object({
  sessionId: z.string().min(1).max(160)
});

export async function GET(
  _request: Request,
  context: {
    params: {
      sessionId: string;
    };
  }
) {
  const parsed = paramsSchema.safeParse(context.params);

  if (!parsed.success) {
    return Response.json({ error: "Invalid session id." }, { status: 400 });
  }

  try {
    const session = await getRequirementSession(parsed.data.sessionId);

    if (!session) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    return Response.json(session);
  } catch (error) {
    return Response.json(
      {
        error: "Failed to read requirement session.",
        details:
          error instanceof Error ? error.message : "Unknown requirement session read failure."
      },
      { status: 500 }
    );
  }
}
