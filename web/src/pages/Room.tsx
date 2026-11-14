import { useCallback, useEffect, useRef, useState } from "react";
import type { Language, RunResult, SessionView } from "../../../shared/types";
import { api, type Workspace } from "../lib/api";
import { STRICTNESS } from "../lib/format";
import { Chat, type ChatHandle } from "../components/Chat";
import { CodeWorkspace } from "../components/CodeWorkspace";
import { DesignWorkspace, type DesignHandle } from "../components/DesignWorkspace";
import { FollowUps } from "../components/FollowUps";
import { Markdown } from "../components/Markdown";
import { Report } from "../components/Report";
import { CollapseButton, RoomLayout } from "../components/RoomLayout";

export function Room({ id }: { id: string }) {
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => api.session(id).then(setView, (e) => setError(e.message)), [id]);
  useEffect(() => void reload(), [reload]);

  if (error) return <div className="center"><div className="banner error">{error}</div><a href="#/">Back</a></div>;
  if (!view) return <div className="center muted">Loading…</div>;
  return <RoomInner key={view.session.status} view={view} reload={reload} />;
}

function RoomInner({ view, reload }: { view: SessionView; reload: () => void }) {
  const { session, question } = view;
  const isCoding = question.type === "coding";
  const status = session.status;
  const readOnly = status !== "in_progress";
  const strict = session.config.strictness === "strict";

  const [showReport, setShowReport] = useState(status === "evaluated");
  const [leftTab, setLeftTab] = useState<"prompt" | "tests" | "followups">(status === "followups" ? "followups" : "prompt");
  const [language, setLanguage] = useState<Language>(session.config.language ?? "python");
  const [codeByLang, setCodeByLang] = useState<Partial<Record<Language, string>>>({ ...question.starter, ...session.code });
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Counts interviewer replies; the collapsed chat rail shows a dot for replies it hasn't shown yet.
  const [replies, setReplies] = useState(0);
  const onInterviewerReply = useCallback(() => setReplies((n) => n + 1), []);

  const chatRef = useRef<ChatHandle>(null);
  const designRef = useRef<DesignHandle>(null);
  const codeRef = useRef({ language, code: codeByLang[language] ?? "" });
  codeRef.current = { language, code: codeByLang[language] ?? "" };

  const getWorkspace = useCallback((): Workspace | undefined => {
    if (readOnly) return undefined;
    return isCoding ? { ...codeRef.current } : designRef.current?.snapshot();
  }, [isCoding, readOnly]);

  // Debounced autosave into sessions/<id>/workspace/.
  const saveTimer = useRef<number | undefined>(undefined);
  const scheduleSave = useCallback(() => {
    if (readOnly) return;
    setSaveState("dirty");
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const ws = getWorkspace();
      if (!ws) return;
      setSaveState("saving");
      await api.saveWorkspace(session.id, ws).catch(() => {});
      setSaveState("saved");
    }, 1500);
  }, [getWorkspace, readOnly, session.id]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const onRan = (r: RunResult) => {
    if (session.config.strictness === "coach" && r) chatRef.current?.trigger("run");
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    clearTimeout(saveTimer.current);
    try {
      const ws = isCoding ? { ...codeRef.current } : await designRef.current!.snapshotWithImage();
      await api.submit(session.id, ws);
      reload();
    } catch (e) {
      setSubmitError((e as Error).message);
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  };

  if (showReport && status === "evaluated") {
    return (
      <div className="room-report">
        <RoomHeader view={view} />
        <Report sessionId={session.id} folder={view.folder} onShowWorkspace={() => setShowReport(false)} />
      </div>
    );
  }

  return (
    <div className="room">
      <RoomHeader view={view}>
        {status === "in_progress" && (
          <>
            <span className={`save ${saveState}`}>{saveState === "saved" ? "saved" : saveState === "saving" ? "saving…" : "unsaved"}</span>
            {confirmSubmit ? (
              <>
                <span className="small nowrap">Submit? No edits after.</span>
                <button className="ghost small" onClick={() => setConfirmSubmit(false)}>
                  Keep working
                </button>
                <button className="primary small" onClick={submit} disabled={submitting}>
                  {submitting ? (isCoding ? "Running hidden tests…" : "Submitting…") : "Yes, submit"}
                </button>
              </>
            ) : (
              <button className="primary small" onClick={() => setConfirmSubmit(true)}>
                Submit
              </button>
            )}
          </>
        )}
        {status === "evaluated" && (
          <button className="primary small" onClick={() => setShowReport(true)}>
            View feedback
          </button>
        )}
      </RoomHeader>
      {submitError && <div className="banner error">{submitError}</div>}

      <RoomLayout
        id={isCoding ? "coding" : "design"}
        leftLabel={question.followUps && status === "followups" ? "Prompt · Follow-ups" : "Prompt"}
        rightLabel="Interviewer"
        leftDefault={isCoding ? "26%" : "22%"}
        rightDefault="25%"
        rightActivity={replies}
        left={({ collapse }) => (
        <aside className="left">
          <div className="tabs">
            <button className={leftTab === "prompt" ? "on" : ""} onClick={() => setLeftTab("prompt")}>
              Prompt
            </button>
            {isCoding && !strict && (
              <button className={leftTab === "tests" ? "on" : ""} onClick={() => setLeftTab("tests")}>
                Sample tests
              </button>
            )}
            {question.followUps && (
              <button className={leftTab === "followups" ? "on" : ""} onClick={() => setLeftTab("followups")}>
                Follow-ups
              </button>
            )}
            <div className="spacer" />
            <CollapseButton side="left" onClick={collapse} />
          </div>
          <div className="left-body">
            {leftTab === "prompt" && <Markdown>{question.prompt}</Markdown>}
            {leftTab === "tests" && (
              <div className="sample-tests">
                {question.publicTests?.map((t, i) => (
                  <div key={i} className="sample">
                    <div className="muted small">{t.name ?? `Test ${i + 1}`}</div>
                    {t.ops && <code>ops: {JSON.stringify(t.ops)}</code>}
                    <code>args: {JSON.stringify(t.args)}</code>
                    <code>expected: {JSON.stringify(t.expected)}</code>
                  </div>
                ))}
                <p className="muted small">Hidden tests also run when you submit.</p>
              </div>
            )}
            {leftTab === "followups" && question.followUps && (
              status === "followups" ? (
                <FollowUps sessionId={session.id} questions={question.followUps} initial={session.followUpAnswers} onEvaluated={reload} />
              ) : (
                <ol className="fu-readonly">
                  {question.followUps.map((q, i) => (
                    <li key={i}>
                      <p>{q}</p>
                      <blockquote>{session.followUpAnswers?.[i] || "(no answer)"}</blockquote>
                    </li>
                  ))}
                </ol>
              )
            )}
          </div>
        </aside>
        )}
        center={
        <main className="center-pane">
          {isCoding ? (
            <CodeWorkspace
              sessionId={session.id}
              question={question}
              strict={strict}
              language={language}
              code={codeByLang[language] ?? ""}
              readOnly={readOnly}
              lastSubmit={view.lastSubmit}
              onLanguage={(l) => {
                setLanguage(l);
                scheduleSave();
              }}
              onCode={(c) => {
                setCodeByLang((m) => ({ ...m, [language]: c }));
                scheduleSave();
              }}
              onRan={onRan}
            />
          ) : (
            <DesignWorkspace ref={designRef} markdown={session.design?.markdown ?? ""} scene={session.design?.scene} readOnly={readOnly} onChange={scheduleSave} />
          )}
        </main>
        }
        right={({ collapse }) => (
        <aside className="right">
          <Chat
            ref={chatRef}
            session={session}
            initial={view.transcript}
            getWorkspace={getWorkspace}
            readOnly={status === "evaluated" || status === "evaluating"}
            headerAction={<CollapseButton side="right" onClick={collapse} />}
            onInterviewerReply={onInterviewerReply}
          />
        </aside>
        )}
      />
    </div>
  );
}

function RoomHeader({ view, children }: { view: SessionView; children?: React.ReactNode }) {
  const { session, question } = view;
  return (
    <header className="room-header">
      <a href="#/" className="logo">
        de-faang
      </a>
      <div className="room-title">
        <strong>{question.title}</strong>
        <span className={`diff ${question.difficulty}`}>{question.difficulty}</span>
        <span className="badge">{STRICTNESS[session.config.strictness].label}</span>
        <Timer start={session.createdAt} end={session.submittedAt} limit={question.durationMinutes} />
      </div>
      <div className="spacer" />
      <code className="folder" title="Session folder (gitignored)">
        {view.folder}
      </code>
      {children}
    </header>
  );
}

function Timer({ start, end, limit }: { start: string; end?: string; limit: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (end) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [end]);
  const ms = (end ? Date.parse(end) : now) - Date.parse(start);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const over = m >= limit;
  return (
    <span className={`timer ${over ? "over" : m >= limit * 0.8 ? "warn" : ""}`} title={`Suggested: ${limit} minutes`}>
      ⏱ {m}:{String(s).padStart(2, "0")} / {limit}:00
    </span>
  );
}
