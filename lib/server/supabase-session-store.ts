import "server-only";

import {
  storedRequirementSessionSchema,
  type StoredRequirementSession
} from "@/lib/requirements/contracts";

type SupabaseRequirementSessionRow = {
  session_id: string;
  state: unknown;
  messages: unknown;
  extraction_history: unknown;
  created_at: string;
  updated_at: string;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url,
    serviceRoleKey
  };
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseConfig());
}

function toStoredSession(row: SupabaseRequirementSessionRow): StoredRequirementSession {
  return storedRequirementSessionSchema.parse({
    sessionId: row.session_id,
    state: row.state,
    messages: row.messages,
    extractionHistory: row.extraction_history,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function toRow(session: StoredRequirementSession): SupabaseRequirementSessionRow {
  return {
    session_id: session.sessionId,
    state: session.state,
    messages: session.messages,
    extraction_history: session.extractionHistory,
    created_at: session.createdAt,
    updated_at: session.updatedAt
  };
}

async function requestSupabase<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase request failed (${response.status}): ${details}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getSupabaseRequirementSession(
  sessionId: string
): Promise<StoredRequirementSession | null> {
  const rows = await requestSupabase<SupabaseRequirementSessionRow[]>(
    `requirement_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=*`
  );

  return rows[0] ? toStoredSession(rows[0]) : null;
}

export async function listSupabaseRequirementSessions(): Promise<StoredRequirementSession[]> {
  const rows = await requestSupabase<SupabaseRequirementSessionRow[]>(
    "requirement_sessions?select=*&order=updated_at.desc"
  );

  return rows.map(toStoredSession);
}

export async function upsertSupabaseRequirementSession(session: StoredRequirementSession) {
  await requestSupabase<void>("requirement_sessions", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(toRow(session))
  });
}
