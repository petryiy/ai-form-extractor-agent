import "server-only";

import type {
  ExtractResponse,
  StoredRequirementSession,
  VisibleMessage
} from "@/lib/requirements/contracts";
import type { RequirementState } from "@/lib/requirements/schema";

type WebhookMode = "always" | "complete";

function getWebhookMode(): WebhookMode {
  return process.env.REQUIREMENT_WEBHOOK_MODE === "always" ? "always" : "complete";
}

export async function notifyRequirementWebhook({
  sessionId,
  state,
  messages,
  extraction
}: {
  sessionId: string;
  state: RequirementState;
  messages: VisibleMessage[];
  extraction: ExtractResponse;
}) {
  const webhookUrl = process.env.REQUIREMENT_WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  const mode = getWebhookMode();

  if (mode === "complete" && extraction.completeness < 1) {
    return;
  }

  const payload = {
    event: extraction.completeness === 1 ? "requirement.completed" : "requirement.updated",
    sessionId,
    state,
    messages,
    extraction,
    sentAt: new Date().toISOString()
  } satisfies Omit<StoredRequirementSession, "createdAt" | "updatedAt" | "extractionHistory"> & {
    event: "requirement.completed" | "requirement.updated";
    extraction: ExtractResponse;
    sentAt: string;
  };

  const headers: HeadersInit = {
    "Content-Type": "application/json"
  };

  if (process.env.REQUIREMENT_WEBHOOK_SECRET) {
    headers["X-Requirement-Agent-Secret"] = process.env.REQUIREMENT_WEBHOOK_SECRET;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}.`);
  }
}
