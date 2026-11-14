import { useEffect, useRef, useState } from "react";
import type { DebriefEntry, LessonMeta } from "../../../shared/types";
import { api, streamDebrief, streamLesson } from "../lib/api";
import { Markdown } from "./Markdown";

const STARTERS = [
  "How could I have done better?",
  "What was the turning point of this interview?",
  "Walk me through the strongest solution step by step.",
  "What should I have asked or said, and when?",
  "Quiz me on what I missed.",
];

/**
 * After evaluation: a coaching chat about the round, and lessons generated from the round, its
 * evaluation, and this conversation.
 */
export function Debrief({ sessionId, onLessonCount }: { sessionId: string; onLessonCount?: (n: number) => void }) {
  const [messages, setMessages] = useState<DebriefEntry[] | null>(null);
  const [lessons, setLessons] = useState<LessonMeta[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [focus, setFocus] = useState("");
  const [lessonDraft, setLessonDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const busy = streaming !== null || lessonDraft !== null;

  useEffect(() => {
    api.debrief(sessionId).then(
      (d) => {
        setMessages(d.messages);
        setLessons(d.lessons);
      },
      (e) => setError(e.message),
    );
  }, [sessionId]);
  useEffect(() => onLessonCount?.(lessons.length), [lessons.length, onLessonCount]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, streaming, lessonDraft]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setDraft("");
    setError(null);
    setPending(t);
    setStreaming("");
    try {
      const r = await streamDebrief(sessionId, t, (d) => setStreaming((s) => (s ?? "") + d));
      setMessages((m) => [...(m ?? []), ...[r.sent, r.reply].filter((x): x is DebriefEntry => Boolean(x))]);
    } catch (e) {
      setError((e as Error).message);
      setDraft(t);
      // The candidate's message may have been saved before the failure; resync.
      api.debrief(sessionId).then((d) => setMessages(d.messages), () => {});
    } finally {
      setPending(null);
      setStreaming(null);
    }
  };

  const makeLesson = async () => {
    if (busy) return;
    setError(null);
    setLessonDraft("");
    try {
      const lesson = await streamLesson(sessionId, focus, (d) => setLessonDraft((s) => (s ?? "") + d));
      if (lesson) {
        setLessons((l) => [...l, lesson]);
        setFocus("");
        location.hash = `#/lesson/${sessionId}/${lesson.id}`;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLessonDraft(null);
    }
  };

  if (!messages) return error ? <div className="banner error">{error}</div> : <p className="muted">Loading…</p>;

  return (
    <div className="debrief">
      <section className="debrief-chat">
        <div className="debrief-list" ref={listRef}>
          {lessonDraft !== null ? (
            <div className="lesson-draft">
              <div className="muted small">Writing your lesson… it opens when it's done.</div>
              {lessonDraft ? <Markdown>{lessonDraft}</Markdown> : <span className="typing">●●●</span>}
            </div>
          ) : (
            <>
              {messages.length === 0 && pending === null && (
                <div className="debrief-intro">
                  <p>
                    Talk the round over with a coach who has seen everything: your code or design, the transcript, the tests, the
                    interviewer's private notes, and the evaluation. Ask what you could have done better, or dig into any moment.
                  </p>
                  <div className="starters">
                    {STARTERS.map((s) => (
                      <button key={s} className="ghost small" onClick={() => void send(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`bubble ${m.role === "coach" ? "interviewer" : "candidate"}`}>
                  {m.role === "coach" ? <Markdown>{m.text}</Markdown> : <div className="plain">{m.text}</div>}
                </div>
              ))}
              {pending !== null && (
                <div className="bubble candidate">
                  <div className="plain">{pending}</div>
                </div>
              )}
              {streaming !== null && <div className="bubble interviewer">{streaming ? <Markdown>{streaming}</Markdown> : <span className="typing">●●●</span>}</div>}
            </>
          )}
          {error && <div className="banner error small">{error}</div>}
        </div>
        <div className="chat-input">
          <textarea
            value={draft}
            disabled={lessonDraft !== null}
            placeholder="Ask the coach… (Enter to send, Shift+Enter for a new line)"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
          />
          <div className="chat-actions">
            <span className="muted small">Saved to debrief.jsonl in the session folder.</span>
            <button className="primary small" disabled={!draft.trim() || busy} onClick={() => void send(draft)}>
              Send
            </button>
          </div>
        </div>
      </section>

      <aside className="debrief-side">
        <h3>Turn it into a lesson</h3>
        <p className="muted small">
          A personalised lesson built from this round, its evaluation{messages.length ? ", and this conversation" : ""}: the concept, your key
          moments and the stronger move, a worked example, practice exercises, and a checklist.
        </p>
        <textarea
          className="focus"
          value={focus}
          placeholder="Optional focus, e.g. “edge cases I missed” or “explaining complexity”"
          onChange={(e) => setFocus(e.target.value)}
          disabled={busy}
        />
        <button className="primary" disabled={busy} onClick={() => void makeLesson()}>
          {lessonDraft !== null ? "Writing lesson…" : "✎ Create lesson"}
        </button>

        <h3>Lessons from this round</h3>
        {lessons.length === 0 ? (
          <p className="muted small">None yet.</p>
        ) : (
          <ul className="lesson-links">
            {[...lessons].reverse().map((l) => (
              <li key={l.id}>
                <a href={`#/lesson/${sessionId}/${l.id}`}>{l.title}</a>
                <div className="muted small">
                  {new Date(l.createdAt).toLocaleString()}
                  {l.focus ? ` · focus: ${l.focus}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
