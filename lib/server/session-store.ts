import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ExtractResponse,
  StoredRequirementSession,
  VisibleMessage
} from "@/lib/requirements/contracts";
import { storedRequirementSessionSchema } from "@/lib/requirements/contracts";
import type { RequirementState } from "@/lib/requirements/schema";

type SessionStore = Record<string, StoredRequirementSession>;

const dataDirectory = path.join(process.cwd(), ".data");
const storePath = path.join(dataDirectory, "requirement-sessions.json");

async function readStore(): Promise<SessionStore> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as SessionStore;

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([sessionId, session]) => {
        const safeSession = storedRequirementSessionSchema.safeParse(session);
        return safeSession.success ? [[sessionId, safeSession.data]] : [];
      })
    );
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;

    if (code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeStore(store: SessionStore) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function saveRequirementSession({
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
  const store = await readStore();
  const now = extraction.updatedAt;
  const current = store[sessionId];

  store[sessionId] = {
    sessionId,
    state,
    messages,
    extractionHistory: [
      ...(current?.extractionHistory ?? []),
      {
        updatedAt: extraction.updatedAt,
        completeness: extraction.completeness,
        changes: extraction.changes,
        evidence: extraction.evidence,
        customerIntent: extraction.customerIntent,
        confidence: extraction.confidence,
        notes: extraction.notes
      }
    ],
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };

  await writeStore(store);
}

export async function getRequirementSession(
  sessionId: string
): Promise<StoredRequirementSession | null> {
  const store = await readStore();
  return store[sessionId] ?? null;
}

export async function listRequirementSessions(): Promise<StoredRequirementSession[]> {
  const store = await readStore();
  return Object.values(store).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
