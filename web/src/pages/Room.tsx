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
import { DebugWorkspace } from "../components/debug/DebugWorkspace";
import { ProjectBrowser } from "../components/debug/ProjectBrowser";
import { useProject } from "../components/debug/useProject";

export function Room({ id }: { id: string }) {
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => api.session(id).then(setView, (e) => setError(e.message)), [id]);
  useEffect(() => void reload(), [reload]);

  if (error) return <div className="center"><div className="banner error">{error}</div><a href="#/">Back</a></div>;
  if (!view) return <div className="center muted">Loading…</div>;
  // Remount when the round moves on (submit, or the next part of a multipart question).
  return <RoomInner key={`${view.session.status}-${view.session.part ?? 0}`} view={view} reload={reload} />;
}

function RoomInner({ view, reload }: { view: SessionView; reload: () => void }) {
  const { session, question } = view;
  const isCoding = question.type === "coding";
  const isDebug = question.type === "debugging";
  const status = session.status;
  const readOnly = status !== "in_progress";
  const strict = session.config.strictness === "strict";

  const [showReport, setShowReport] = useState(status === "evaluated");
  const [leftTab, setLeftTab] = useState<"prompt" | "tests" | "files" | "followups">(status === "followups" ? "followups" : "prompt");
  const [language, setLanguage] = useState<Language>(session.config.language ?? "python");
  const [codeByLang, setCodeByLang] = useState<Partial<Record<Language, string>>>({ ...question.starter, ...session.code });
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<null | "submit" | "part">(null);
  const part = question.part ?? 0;
  const partCount = question.parts ?? 1;
  const hasNextPart = isCoding && part < partCount - 1;
  const [codeSaveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  // Debugging rounds: the project's files and editor tabs (each file autosaves on its own).
  const project = useProject(session.id, question.project?.files ?? [], question.project?.open, readOnly);
  const saveState = isDebug ? project.saveState : codeSaveState;
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Counts interviewer replies; the collapsed chat rail shows a dot for replies it hasn't shown yet.
  const [replies, setReplies] = useState(0);
  const onInterviewerReply = useCallback(() => setReplies((n) => n + 1), []);

  const chatRef = useRef<ChatHandle>(null);
  const designRef = useRef<DesignHandle>(null);
  const codeRef = useRef({ language, code: codeByLang[language] ?? "" });
  codeRef.current = { language, code: codeByLang[language] ?? "" };

  const getWorkspace = useCallback((): Workspace | undefined => {
    if (readOnly || isDebug) return undefined;
    return isCoding ? { ...codeRef.current } : designRef.current?.snapshot();
  }, [isCoding, isDebug, readOnly]);

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
      if (isDebug) await project.flush();
      const ws = isDebug ? undefined : isCoding ? { ...codeRef.current } : await designRef.current!.snapshotWithImage();
      await api.submit(session.id, ws);
      reload();
    } catch (e) {
      setSubmitError((e as Error).message);
      setSubmitting(false);
      setConfirm(null);
    }
  };

  /** Multipart: hand in the current part and reveal the next one. */
  const finishPart = async () => {
    setSubmitting(true);
    setSubmitError(null);
    clearTimeout(saveTimer.current);
    try {
      await api.nextPart(session.id, { ...codeRef.current });
      reload();
    } catch (e) {
      setSubmitError((e as Error).message);
      setSubmitting(false);
      setConfirm(null);
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
            <span className={`save ${saveState}`}>{saveState === "saved" ? "saved" : saveState === "saving" ? "saving…" : saveState === "error" ? "not saved" : "unsaved"}</span>
            {confirm === "part" ? (
              <>
                <span className="small nowrap">Hand in part {part + 1}? Its hidden tests run now.</span>
                <button className="ghost small" onClick={() => setConfirm(null)}>
                  Keep working
                </button>
                <button className="primary small" onClick={finishPart} disabled={submitting}>
                  {submitting ? "Running tests…" : `Yes, on to part ${part + 2}`}
                </button>
              </>
            ) : confirm === "submit" ? (
              <>
                <span className="small nowrap">
                  {hasNextPart ? `End the round now? Parts ${part + 2}–${partCount} won't be shown.` : "Submit? No edits after."}
                </span>
                <button className="ghost small" onClick={() => setConfirm(null)}>
                  Keep working
                </button>
                <button className="primary small" onClick={submit} disabled={submitting}>
                  {submitting ? (isCoding ? "Running hidden tests…" : isDebug ? "Running checks…" : "Submitting…") : "Yes, submit"}
                </button>
              </>
            ) : hasNextPart ? (
              <>
                <button className="ghost small" onClick={() => setConfirm("submit")} title="Submit without doing the remaining parts">
                  End round
                </button>
                <button className="primary small" onClick={() => setConfirm("part")}>
                  Finish part {part + 1} →
                </button>
              </>
            ) : (
              <button className="primary small" onClick={() => setConfirm("submit")}>
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
        id={isCoding ? "coding" : isDebug ? "debugging" : "design"}
        leftLabel={question.followUps && status === "followups" ? "Prompt · Follow-ups" : isDebug ? "Prompt · Files" : "Prompt"}
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
                {question.partViews ? `Part ${part + 1} tests` : "Sample tests"}
              </button>
            )}
            {isDebug && (
              <button className={leftTab === "files" ? "on" : ""} onClick={() => setLeftTab("files")} title="Browse and open the project's files">
                Files
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
          <div className={`left-body ${leftTab === "files" ? "flush" : ""}`}>
            {leftTab === "prompt" && (question.partViews ? <PartsPrompt question={question} /> : <Markdown>{question.prompt}</Markdown>)}
            {leftTab === "files" && isDebug && <ProjectBrowser project={project} />}
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
          {isDebug ? (
            <DebugWorkspace
              sessionId={session.id}
              project={project}
              readOnly={readOnly}
              checks={Boolean(question.project?.checks)}
              activity={view.activity ?? []}
              lastSubmit={view.lastSubmit}
              onRan={onRan}
              ai={session.config.format === "ai" ? { log: view.ai ?? [], policy: session.config.aiPolicy } : undefined}
            />
          ) : isCoding ? (
            <CodeWorkspace
              sessionId={session.id}
              question={question}
              strict={strict}
              language={language}
              code={codeByLang[language] ?? ""}
              readOnly={readOnly}
              lastSubmit={view.lastSubmit ?? view.lastPartResult}
              ai={session.config.format === "ai" ? { log: view.ai ?? [], policy: session.config.aiPolicy } : undefined}
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

/** Multipart prompt: the introduction, every part reached so far (newest open), and the parts still locked. */
function PartsPrompt({ question }: { question: SessionView["question"] }) {
  const parts = question.partViews ?? [];
  const current = question.part ?? 0;
  const total = question.parts ?? parts.length;
  return (
    <div className="parts-prompt">
      <Markdown>{question.prompt}</Markdown>
      {parts.map((p) => (
        <details key={p.id} className={`part ${p.index === current ? "current" : "done"}`} open={p.index === current}>
          <summary>
            <span className="part-no">Part {p.index + 1}</span> {p.title}
            {p.index < current && <span className="muted small"> · handed in</span>}
          </summary>
          <Markdown>{p.prompt}</Markdown>
        </details>
      ))}
      {Array.from({ length: total - parts.length }, (_, i) => (
        <div key={i} className="part locked muted small">
          <span className="part-no">Part {parts.length + i + 1}</span> unlocks when you finish part {parts.length + i}.
        </div>
      ))}
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
        {session.config.format === "ai" && (
          <span className="badge ai" title={`AI assistant: ${session.config.aiPolicy}`}>
            ✦ AI-assisted
          </span>
        )}
        {question.parts && session.status === "in_progress" && (
          <span className="badge">
            Part {(question.part ?? 0) + 1} of {question.parts}
          </span>
        )}
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
