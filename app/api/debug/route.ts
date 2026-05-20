import { getAiApiConfig, hasAiConfig } from "@/lib/ai/provider";
import {
  checkRequirementSessionStorage,
  getRequirementSessionStorageMode
} from "@/lib/server/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getAiApiConfig();
  const storageMode = getRequirementSessionStorageMode();
  const storageHealth = await checkRequirementSessionStorage()
    .then(() => ({
      ok: true,
      error: null
    }))
    .catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown storage health check failure."
    }));

  return Response.json({
    app: "ai-requirement-elicitation-agent",
    extractionRuntime: "native-deepseek-json-v2",
    hasAiConfig: hasAiConfig(),
    model: config.model,
    baseURL: config.baseURL,
    hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    storage: {
      mode: storageMode,
      ...storageHealth
    },
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    generatedAt: new Date().toISOString()
  });
}
