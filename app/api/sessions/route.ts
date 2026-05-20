import { listRequirementSessions } from "@/lib/server/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await listRequirementSessions();

    return Response.json({
      sessions: sessions.map((session) => ({
        sessionId: session.sessionId,
        state: session.state,
        completeness: session.extractionHistory.at(-1)?.completeness ?? 0,
        messageCount: session.messages.length,
        extractionCount: session.extractionHistory.length,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }))
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to read requirement sessions.",
        details: error instanceof Error ? error.message : "Unknown storage read failure."
      },
      { status: 500 }
    );
  }
}
