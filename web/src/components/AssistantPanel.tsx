import { useEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import type { AiLogEntry, Language } from "../../../shared/types";
import { api, streamAssistant } from "../lib/api";
import { Markdown } from "./Markdown";

interface Props {
  sessionId: string;
  readOnly: boolean;
  policy?: string;
  language: Language;
  log: AiLogEntry[];
  onLog: (entries: AiLogEntry[]) => void;
  getCode: () => string;
  onInsert: (code: string) => void;
  onReplace: (code: string) => void;
}

/** Plain text of a hast node (react-markdown's `node`), used to read a code block's contents. */
function textOf(node: unknown): string {
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n?.type === "text") return n.value ?? "";
  return (n?.children ?? []).map(textOf).join("");
}

const ACTION_LABEL: Record<"insert" | "replace" | "copy" | "paste", (e: AiLogEntry & { lines: number }) => string> = {
  insert: (e) => `Inserted ${e.lines} line(s) at the cursor`,
  replace: (e) => `Replaced the editor with ${e.lines} line(s)`,
  copy: (e) => `Copied ${e.lines} line(s)`,
  paste: (e) => `Pasted ${e.lines} line(s) into the editor${"fromAi" in e && e.fromAi ? " (from the AI)" : ""}`,
};

/**
 * The AI assistant in AI-assisted rounds. Everything the candidate sends, what was attached, the
 * replies, and what they do with code blocks (insert, replace, copy) is logged by the server.
 */
export function AssistantPanel(p: Props) {
  const [draft, setDraft] = useState("");
  const [attachProblem, setAttachProblem] = useState(true);
  const [attachCode, setAttachCode] = useState(true);
  const [pending, setPending] = useState<string | null>(null); // the prompt being answered
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const log = useRef(p.log);
  log.current = p.log;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [p.log, streaming]);

  const record = async (e: Parameters<typeof api.aiEvent>[1]) => {
    try {
      const { entry } = await api.aiEvent(p.sessionId, e);
      p.onLog([...log.current, entry]);
    } catch {
      /* logging failures shouldn't interrupt the candidate */
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || streaming !== null) return;
    setDraft("");
    setError(null);
    setPending(text);
    setStreaming("");
    try {
      const r = await streamAssistant(
        p.sessionId,
        { text, attachProblem, attachCode, language: p.language, code: p.getCode() },
        (d) => setStreaming((s) => (s ?? "") + d),
      );
      p.onLog([...log.current, ...[r.prompt, r.response].filter((x): x is AiLogEntry => Boolean(x))]);
      if (r.error) setError(r.error);
    } catch (e) {
      setError((e as Error).message);
      setDraft(text);
    } finally {
      setPending(null);
      setStreaming(null);
    }
  };

  const codeComponents = useMemo<Components>(
    () => ({
      pre: ({ node, children }) => {
        const code = textOf(node).replace(/\n$/, "");
        return (
          <div className="ai-code">
            {!p.readOnly && (
              <div className="ai-code-bar">
                <button
                  className="ghost small"
                  title="Insert at the cursor in your editor"
                  onClick={() => {
                    p.onInsert(code);
                    void record({ kind: "insert", code });
                  }}
                >
                  Insert
                </button>
                <button
                  className="ghost small"
                  title="Replace everything in your editor with this code"
                  onClick={() => {
                    p.onReplace(code);
                    void record({ kind: "replace", code });
                  }}
                >
                  Replace editor
                </button>
                <button
                  className="ghost small"
                  onClick={() => {
                    void navigator.clipboard?.writeText(code).catch(() => {});
                    void record({ kind: "copy", code });
                  }}
                >
                  Copy
                </button>
              </div>
            )}
            <pre>{children}</pre>
          </div>
        );
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.readOnly, p.onInsert, p.onReplace, p.sessionId],
  );

  // Copying part of a reply with the keyboard or mouse is logged too.
  const onCopy = () => {
    const sel = window.getSelection()?.toString() ?? "";
    if (sel.trim() && !p.readOnly) void record({ kind: "copy", code: sel, source: "selection" });
  };

  return (
    <div className="assistant">
      <div className="assistant-list" ref={listRef} onCopy={onCopy}>
        {p.log.length === 0 && pending === null && (
          <p className="muted small">
            Ask the AI to analyse the problem, explain an idea, review your code, or write code. Everything you send and what you do with the
            replies is recorded and assessed: how well you direct the AI and how carefully you check its output.
            {p.policy && <> Helpfulness: <strong>{p.policy}</strong>.</>}
          </p>
        )}
        {p.log.map((e, i) => {
          switch (e.kind) {
            case "prompt":
              return (
                <div key={i} className="bubble candidate">
                  <div className="plain">{e.text}</div>
                  {(e.attachProblem || e.attachCode) && (
                    <div className="attach-chips">
                      {e.attachProblem && <span className="chip">problem</span>}
                      {e.attachCode && <span className="chip">code</span>}
                    </div>
                  )}
                </div>
              );
            case "response":
              return e.error ? (
                <div key={i} className="banner error small">
                  {e.error}
                </div>
              ) : (
                <div key={i} className="bubble assistant-reply">
                  <Markdown components={codeComponents}>{e.text}</Markdown>
                </div>
              );
            case "reset":
              return (
                <div key={i} className="chat-event">
                  New chat
                </div>
              );
            default:
              return (
                <div key={i} className="ai-action muted small">
                  {ACTION_LABEL[e.kind](e)}
                  {e.kind === "copy" && e.source === "selection" ? " from a reply" : ""}
                </div>
              );
          }
        })}
        {pending !== null && (
          <div className="bubble candidate">
            <div className="plain">{pending}</div>
          </div>
        )}
        {streaming !== null && (
          <div className="bubble assistant-reply">{streaming ? <Markdown components={codeComponents}>{streaming}</Markdown> : <span className="typing">●●●</span>}</div>
        )}
        {error && <div className="banner error small">{error}</div>}
      </div>
      {!p.readOnly && (
        <div className="assistant-input">
          <textarea
            value={draft}
            placeholder="Ask the AI… (Enter to send, Shift+Enter for a new line)"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="assistant-actions">
            <label className="check small" title="Send the problem statement with this message">
              <input type="checkbox" checked={attachProblem} onChange={(e) => setAttachProblem(e.target.checked)} /> attach problem
            </label>
            <label className="check small" title="Send your current code with this message">
              <input type="checkbox" checked={attachCode} onChange={(e) => setAttachCode(e.target.checked)} /> attach my code
            </label>
            <div className="spacer" />
            <button className="ghost small" disabled={streaming !== null || p.log.length === 0} title="Start a fresh conversation; the AI forgets earlier messages" onClick={() => void record({ kind: "reset" })}>
              New chat
            </button>
            <button className="primary small" disabled={!draft.trim() || streaming !== null} onClick={() => void send()}>
              Ask AI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
