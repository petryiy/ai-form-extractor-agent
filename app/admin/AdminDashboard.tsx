"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Inbox,
  Loader2,
  RefreshCw,
  Search
} from "lucide-react";
import {
  sessionListResponseSchema,
  storedRequirementSessionSchema,
  type SessionSummary,
  type StoredRequirementSession
} from "@/lib/requirements/contracts";
import { requirementCriteria, type RequirementKey } from "@/lib/requirements/schema";
import { formatRequirementValue, isMissingValue } from "@/lib/requirements/state";

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function previewTitle(session: SessionSummary) {
  const industry = session.state.industry ?? "未确认行业";
  const painPoint = session.state.corePainPoints?.[0] ?? "待补充痛点";

  return `${industry} · ${painPoint}`;
}

function renderRequirementValue(value: StoredRequirementSession["state"][RequirementKey]) {
  if (isMissingValue(value)) {
    return <span className="empty-value">待确认</span>;
  }

  if (Array.isArray(value)) {
    return (
      <span className="chip-row">
        {value.map((item) => (
          <span className="value-chip" key={item}>
            {item}
          </span>
        ))}
      </span>
    );
  }

  return <span>{formatRequirementValue(value)}</span>;
}

export function AdminDashboard() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<StoredRequirementSession | null>(null);
  const [query, setQuery] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return sessions;
    }

    return sessions.filter((session) =>
      JSON.stringify(session).toLowerCase().includes(normalizedQuery)
    );
  }, [query, sessions]);

  async function loadSessions() {
    setErrorMessage(null);
    setIsLoadingList(true);

    try {
      const response = await fetch("/api/sessions", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "读取会话列表失败。");
      }

      const data = sessionListResponseSchema.parse(json);
      setSessions(data.sessions);
      setSelectedSessionId((current) => current ?? data.sessions[0]?.sessionId ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取会话列表失败。");
    } finally {
      setIsLoadingList(false);
    }
  }

  async function loadSessionDetail(sessionId: string) {
    setErrorMessage(null);
    setIsLoadingDetail(true);

    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        cache: "no-store"
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "读取会话详情失败。");
      }

      setSelectedSession(storedRequirementSessionSchema.parse(json));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取会话详情失败。");
      setSelectedSession(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }

  useEffect(() => {
    void loadSessions();
    const timer = window.setInterval(() => {
      void loadSessions();
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      void loadSessionDetail(selectedSessionId);
    } else {
      setSelectedSession(null);
    }
  }, [selectedSessionId]);

  async function copySelectedJson() {
    if (!selectedSession) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(selectedSession.state, null, 2));
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="eyebrow">Requirement Inbox</p>
          <h1>需求表收件箱</h1>
        </div>
        <button className="secondary-button" type="button" onClick={loadSessions}>
          {isLoadingList ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
          <span>刷新</span>
        </button>
      </header>

      {errorMessage ? (
        <div className="error-banner admin-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="admin-grid">
        <section className="admin-list-panel" aria-label="客户需求会话">
          <div className="admin-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索行业、痛点、预算或 session"
            />
          </div>

          <div className="session-list">
            {filteredSessions.length === 0 ? (
              <div className="empty-state">
                <Inbox size={28} />
                <p>{isLoadingList ? "正在读取..." : "还没有客户提交的信息"}</p>
              </div>
            ) : null}

            {filteredSessions.map((session) => (
              <button
                className={`session-row${
                  session.sessionId === selectedSessionId ? " selected" : ""
                }`}
                key={session.sessionId}
                type="button"
                onClick={() => setSelectedSessionId(session.sessionId)}
              >
                <span className="session-title">{previewTitle(session)}</span>
                <span className="session-meta">
                  {Math.round(session.completeness * 100)}% · {formatTime(session.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-detail-panel" aria-label="需求表详情">
          <div className="panel-header admin-detail-header">
            <div>
              <h2>AI 整理结果</h2>
              <p>
                {selectedSession
                  ? `${selectedSession.messages.length} 条消息 · ${
                      selectedSession.extractionHistory.length
                    } 次更新`
                  : "选择一个客户会话"}
              </p>
            </div>
            <div className="admin-header-actions">
              {selectedSession?.extractionHistory.at(-1)?.completeness === 1 ? (
                <span className="complete-pill">
                  <CheckCircle2 size={15} />
                  已齐全
                </span>
              ) : null}
              <button
                className="icon-button"
                type="button"
                onClick={copySelectedJson}
                title="复制 JSON"
                disabled={!selectedSession}
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          {isLoadingDetail ? (
            <div className="empty-state detail-loading">
              <Loader2 className="spin" size={26} />
              <p>正在读取详情...</p>
            </div>
          ) : null}

          {selectedSession && !isLoadingDetail ? (
            <>
              <div className="admin-progress-row">
                <div className="progress-track" aria-label="完成度">
                  <span
                    style={{
                      width: `${Math.round(
                        (selectedSession.extractionHistory.at(-1)?.completeness ?? 0) * 100
                      )}%`
                    }}
                  />
                </div>
                <strong>
                  {Math.round((selectedSession.extractionHistory.at(-1)?.completeness ?? 0) * 100)}
                  %
                </strong>
              </div>

              <div className="admin-fields">
                {requirementCriteria.map((criterion) => (
                  <div className="admin-field" key={criterion.key}>
                    <span className="admin-field-label">
                      <ClipboardCheck size={15} />
                      {criterion.label}
                    </span>
                    <div className="admin-field-value">
                      {renderRequirementValue(selectedSession.state[criterion.key])}
                    </div>
                  </div>
                ))}
              </div>

              <div className="admin-json">
                <div className="json-header">
                  <h3>结构化 JSON</h3>
                  <span>{selectedSession.sessionId}</span>
                </div>
                <pre>{JSON.stringify(selectedSession.state, null, 2)}</pre>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
