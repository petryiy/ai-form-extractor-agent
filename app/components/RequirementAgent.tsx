"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Loader2,
  RotateCcw,
  Send,
  User
} from "lucide-react";
import { z } from "zod";
import { extractResponseSchema, type ExtractResponse } from "@/lib/requirements/contracts";
import {
  requirementCriteria,
  requirementStateSchema,
  type RequirementKey,
  type RequirementState
} from "@/lib/requirements/schema";
import {
  calculateCompleteness,
  createEmptyRequirementState,
  formatRequirementValue,
  getMissingCriteria,
  isMissingValue
} from "@/lib/requirements/state";

const STORAGE_KEY = "ai-requirement-agent-session-v1";

type Locale = "en" | "zh";

const copy = {
  en: {
    welcome:
      "Hi, I’ll ask a few questions to understand your business context, current workflow, priorities, and buying process. You can start by describing the problem you want to solve.",
    emptyValue: "Not confirmed",
    intakeTitle: "Requirement Discovery",
    inspectorTitle: "AI Requirement Agent",
    resetTitle: "Reset conversation",
    stop: "Stop",
    chatTitle: "Conversation",
    inspectorChatTitle: "Customer Conversation",
    processingStatus: "Processing latest reply",
    idleStatus: "Waiting for input",
    organizing: "I’m organizing your information...",
    extractionFallback: "Requirement extraction failed. Please try again.",
    unknownError: "Something went wrong.",
    placeholder: "Type your reply in natural language...",
    send: "Send",
    structuredTitle: "Structured Requirement Report",
    missingRequired: (count: number) => `${count} required fields remaining`,
    completeRequired: "Required fields complete",
    required: "Required",
    recentUpdates: "Recent updates",
    changeCreated: "created",
    changeUpdated: "updated",
    changeCleared: "cleared",
    jsonOutput: "JSON Output",
    copyJson: "Copy JSON",
    percentComplete: "complete"
  },
  zh: {
    welcome:
      "你好，我会先了解你们的业务背景、当前问题、优先级和采购决策。你可以从想解决的业务问题开始讲。",
    emptyValue: "待确认",
    intakeTitle: "需求交流",
    inspectorTitle: "AI 需求获取代理",
    resetTitle: "重置会话",
    stop: "停止生成",
    chatTitle: "在线沟通",
    inspectorChatTitle: "客户对话",
    processingStatus: "正在处理最新回复",
    idleStatus: "等待客户输入",
    organizing: "我正在整理你的信息...",
    extractionFallback: "需求抽取失败，请稍后重试。",
    unknownError: "发生未知错误。",
    placeholder: "输入客户的自然语言回复...",
    send: "发送",
    structuredTitle: "结构化需求表",
    missingRequired: (count: number) => `${count} 个必填项待确认`,
    completeRequired: "必填项已齐全",
    required: "必填",
    recentUpdates: "最近更新",
    changeCreated: "已新增",
    changeUpdated: "已更新",
    changeCleared: "已清空",
    jsonOutput: "JSON 输出",
    copyJson: "复制 JSON",
    percentComplete: "完成"
  }
};

function getBrowserLocale(): Locale {
  if (typeof navigator === "undefined") {
    return "en";
  }

  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function createWelcomeMessage(locale: Locale): Message {
  return {
    id: "welcome",
    role: "assistant",
    content: copy[locale].welcome
  };
}

const persistedSessionSchema = z.object({
  sessionId: z.string(),
  locale: z.enum(["en", "zh"]).optional(),
  requirementState: requirementStateSchema,
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system", "function", "data", "tool"]),
      content: z.string()
    })
  )
});

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

type RequirementAgentProps = {
  showInspector?: boolean;
};

function renderValue(value: RequirementState[RequirementKey], locale: Locale) {
  if (isMissingValue(value)) {
    return <span className="empty-value">{copy[locale].emptyValue}</span>;
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

export function RequirementAgent({ showInspector = false }: RequirementAgentProps) {
  const [locale, setLocale] = useState<Locale>("en");
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(createSessionId);
  const [requirementState, setRequirementState] = useState<RequirementState>(
    createEmptyRequirementState
  );
  const [lastExtraction, setLastExtraction] = useState<ExtractResponse | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, append, isLoading, setMessages, stop } = useChat({
    api: "/api/chat",
    initialMessages: [createWelcomeMessage("en")]
  });

  const t = copy[locale];
  const completeness = calculateCompleteness(requirementState);
  const missingCriteria = useMemo(() => getMissingCriteria(requirementState), [requirementState]);
  const isBusy = isExtracting || isLoading;

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const parsedJson = (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })();
      const parsed = persistedSessionSchema.safeParse(parsedJson);

      if (parsed.success) {
        const nextLocale = parsed.data.locale ?? getBrowserLocale();
        setLocale(nextLocale);
        setSessionId(parsed.data.sessionId);
        setRequirementState(parsed.data.requirementState);
        setMessages(parsed.data.messages as Message[]);
      } else {
        const nextLocale = getBrowserLocale();
        setLocale(nextLocale);
        setMessages([createWelcomeMessage(nextLocale)]);
      }
    } else {
      const nextLocale = getBrowserLocale();
      setLocale(nextLocale);
      setMessages([createWelcomeMessage(nextLocale)]);
    }

    setHydrated(true);
  }, [setMessages]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sessionId,
        locale,
        requirementState,
        messages
      })
    );
  }, [hydrated, locale, messages, requirementState, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, isBusy]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isBusy) {
      return;
    }

    setInput("");
    setErrorMessage(null);
    setIsExtracting(true);

    const pendingMessages = [
      ...messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content
        })),
      {
        id: createSessionId(),
        role: "user" as const,
        content: text
      }
    ];

    try {
      const response = await fetch("/api/requirements/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          messages: pendingMessages,
          currentState: requirementState
        })
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const details = typeof json?.details === "string" ? `: ${json.details}` : "";
        throw new Error(`${json?.error ?? t.extractionFallback}${details}`);
      }

      const extraction = extractResponseSchema.parse(json);
      setRequirementState(extraction.state);
      setLastExtraction(extraction);

      await append(
        {
          role: "user",
          content: text
        },
        {
          body: {
            sessionId,
            requirementState: extraction.state,
            suggestedNextQuestion: extraction.nextQuestion
          }
        }
      );
    } catch (error) {
      console.error("Requirement extraction request failed", error);
      setErrorMessage(error instanceof Error ? error.message : t.unknownError);
    } finally {
      setIsExtracting(false);
    }
  }

  function handleReset() {
    const nextSessionId = createSessionId();
    setSessionId(nextSessionId);
    setRequirementState(createEmptyRequirementState());
    setLastExtraction(null);
    setErrorMessage(null);
    setInput("");
    setMessages([createWelcomeMessage(locale)]);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function toggleLocale() {
    const nextLocale: Locale = locale === "en" ? "zh" : "en";
    setLocale(nextLocale);

    if (messages.length === 1 && messages[0]?.id === "welcome") {
      setMessages([createWelcomeMessage(nextLocale)]);
    }
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(requirementState, null, 2));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <main className={`app-shell${showInspector ? "" : " customer-shell"}`}>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">B2B SaaS Intake</p>
            <h1>{showInspector ? t.inspectorTitle : t.intakeTitle}</h1>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" type="button" onClick={toggleLocale}>
              {locale === "en" ? "中文" : "EN"}
            </button>
            <button className="icon-button" type="button" onClick={handleReset} title={t.resetTitle}>
              <RotateCcw size={18} />
            </button>
            {isLoading ? (
              <button className="secondary-button" type="button" onClick={stop}>
                {t.stop}
              </button>
            ) : null}
          </div>
        </header>

        <div className={showInspector ? "main-grid" : "customer-grid"}>
          <section className="chat-panel" aria-label="客户对话">
            <div className="panel-header">
              <div>
                <h2>{showInspector ? t.inspectorChatTitle : t.chatTitle}</h2>
                <p>{isBusy ? t.processingStatus : t.idleStatus}</p>
              </div>
              {showInspector ? (
                <span className="status-pill">
                  {Math.round(completeness * 100)}
                  % {t.percentComplete}
                </span>
              ) : null}
            </div>

            <div className="message-list" ref={scrollRef}>
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="avatar" aria-hidden="true">
                    {message.role === "user" ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="bubble">
                    <p>{message.content}</p>
                  </div>
                </article>
              ))}
              {isExtracting ? (
                <article className="message assistant">
                  <div className="avatar" aria-hidden="true">
                    <Loader2 className="spin" size={16} />
                  </div>
                  <div className="bubble">
                    <p>{t.organizing}</p>
                  </div>
                </article>
              ) : null}
            </div>

            {errorMessage ? (
              <div className="error-banner" role="alert">
                <AlertTriangle size={16} />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <form className="composer" onSubmit={handleSubmit}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.placeholder}
                rows={3}
              />
              <button className="send-button" type="submit" disabled={!input.trim() || isBusy}>
                {isBusy ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                <span>{t.send}</span>
              </button>
            </form>
          </section>

          {showInspector ? (
            <aside className="insight-panel" aria-label="结构化需求表">
              <div className="panel-header">
                <div>
                  <h2>{t.structuredTitle}</h2>
                  <p>
                    {missingCriteria.length > 0
                      ? t.missingRequired(missingCriteria.length)
                      : t.completeRequired}
                  </p>
                </div>
                <ClipboardCheck size={22} />
              </div>

              <div className="progress-track" aria-label="完成度">
                <span style={{ width: `${Math.round(completeness * 100)}%` }} />
              </div>

              <div className="criteria-list">
                {requirementCriteria.map((criterion) => {
                  const value = requirementState[criterion.key];
                  const missing = isMissingValue(value);

                  return (
                    <div className="criterion" key={criterion.key}>
                      <div className="criterion-title">
                        {missing ? (
                          <span className="criterion-dot" />
                        ) : (
                          <CheckCircle2 className="criterion-check" size={17} />
                        )}
                        <span>{criterion.label}</span>
                        {criterion.required ? <strong>{t.required}</strong> : null}
                      </div>
                      <div className="criterion-value">{renderValue(value, locale)}</div>
                    </div>
                  );
                })}
              </div>

              {lastExtraction?.changes.length ? (
                <div className="change-log">
                  <h3>{t.recentUpdates}</h3>
                  {lastExtraction.changes.map((change) => (
                    <p key={change.key}>
                      {change.label}:{" "}
                      {change.action === "created"
                        ? t.changeCreated
                        : change.action === "updated"
                          ? t.changeUpdated
                          : t.changeCleared}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="json-panel">
                <div className="json-header">
                  <h3>{t.jsonOutput}</h3>
                  <button className="icon-button" type="button" onClick={copyJson} title={t.copyJson}>
                    <Copy size={16} />
                  </button>
                </div>
                <pre>{JSON.stringify(requirementState, null, 2)}</pre>
              </div>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
