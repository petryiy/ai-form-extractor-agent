import { getAiApiConfig, hasAiConfig } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const config = getAiApiConfig();

  return Response.json({
    app: "ai-requirement-elicitation-agent",
    extractionRuntime: "native-deepseek-json-v2",
    hasAiConfig: hasAiConfig(),
    model: config.model,
    baseURL: config.baseURL,
    hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    generatedAt: new Date().toISOString()
  });
}
