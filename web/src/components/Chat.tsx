import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ChatEntry, SessionState } from "../../../shared/types";
import { streamChat, type ChatKind, type Workspace } from "../lib/api";
import { Markdown } from "./Markdown";

export interface ChatHandle {
  /** Ask the interviewer to react to an event (e.g. a test run in coach mode). */
  trigger(kind: ChatKind, text?: string): void;
}

interface Props {
  session: SessionState;
  initial: ChatEntry[];
  getWorkspace: () => Workspace | undefined;
  readOnly: boolean;
  headerAction?: React.ReactNode;
  onInterviewerReply?: () => void;
}

export const Chat = forwardRef<ChatHandle, Props>(function Chat({ session, initial, getWorkspace, readOnly, headerAction, onInterviewerReply }, ref) {
  const [entries, setEntries] = useState<ChatEntry[]>(initial);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  const send = useCallback(
    async (kind: ChatKind, text?: string) => {
      if (busy.current) return;
      busy.current = true;
      setError(null);
      if (kind === "message" || kind === "hint") {
        setEntries((e) => [...e, { role: "candidate", text: text || "Could I get a hint?", at: new Date().toISOString() }]);
      }
      setStreaming("");
      try {
        const entry = await streamChat(session.id, { kind, text, workspace: getWorkspace() }, (d) => setStreaming((s) => (s ?? "") + d));
        if (entry) {
          setEntries((e) => [...e, entry]);
          onInterviewerReply?.();
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setStreaming(null);
        busy.current = false;
      }
    },
    [session.id, getWorkspace, onInterviewerReply],
  );

  useImperativeHandle(ref, () => ({ trigger: (kind, text) => void send(kind, text) }), [send]);

  // The interviewer opens the round.
  useEffect(() => {
    if (!opened.current && initial.length === 0 && session.status === "in_progress") {
      opened.current = true;
      void send("open");
    }
  }, [initial.length, session.status, send]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [entries, streaming]);

  const submit = () => {
    const t = draft.trim();
    if (!t || busy.current) return;
    setDraft("");
    void send("message", t);
  };

  const strict = session.config.strictness === "strict";
  return (
    <div className="chat">
      <div className="panel-head">
        <span>Interviewer</span>
        <span className="panel-head-right">
          <span className="muted small">
            {session.config.provider} · {session.config.strictness}
          </span>
          {headerAction}
        </span>
      </div>
      <div className="chat-list" ref={listRef}>
        {entries.map((e, i) =>
          e.role === "event" ? (
            <div key={i} className="chat-event">
              {e.text.split(". ")[0]}
            </div>
          ) : (
            <div key={i} className={`bubble ${e.role}`}>
              {e.role === "interviewer" ? <Markdown>{e.text}</Markdown> : <div className="plain">{e.text}</div>}
            </div>
          ),
        )}
        {streaming !== null && (
          <div className="bubble interviewer">{streaming ? <Markdown>{streaming}</Markdown> : <span className="typing">●●●</span>}</div>
        )}
        {error && <div className="banner error small">{error}</div>}
      </div>
      {!readOnly && (
        <div className="chat-input">
          <textarea
            value={draft}
            placeholder="Think out loud, ask clarifying questions, explain your approach… (Enter to send, Shift+Enter for a new line)"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="chat-actions">
            <button
              className="ghost small"
              disabled={streaming !== null}
              title={strict ? "In strict mode the interviewer won't give hints, just like a calibrated real interview." : "Ask for the next smallest hint"}
              onClick={() => void send("hint")}
            >
              💡 Hint{strict ? " (strict)" : ""}
            </button>
            <button className="primary small" disabled={!draft.trim() || streaming !== null} onClick={submit}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
