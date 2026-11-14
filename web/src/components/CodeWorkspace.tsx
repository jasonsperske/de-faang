import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { usePersistentLayout } from "../lib/layout";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { AiLogEntry, CaseResult, Language, QuestionView, RunResult, TestCase } from "../../../shared/types";
import { AssistantPanel } from "./AssistantPanel";
import { LANGUAGES } from "../../../shared/types";
import { api } from "../lib/api";
import { fmtJson } from "../lib/format";

interface Props {
  sessionId: string;
  question: QuestionView;
  strict: boolean;
  language: Language;
  code: string;
  readOnly: boolean;
  onLanguage: (l: Language) => void;
  onCode: (c: string) => void;
  onRan: (r: RunResult) => void;
  lastSubmit?: RunResult;
  /** AI-assisted rounds: the assistant's log and helpfulness policy. */
  ai?: { log: AiLogEntry[]; policy?: string };
}

type Tab = "results" | "custom" | "ai";
type MonacoEditor = Parameters<OnMount>[0];

const norm = (l: string) => l.trim().replace(/\s+/g, " ");
/** Whether pasted text came from an AI reply: most of its non-trivial lines appear in one. */
function fromAi(pasted: string, log: AiLogEntry[]): boolean {
  const replies = log.filter((e) => e.kind === "response").map((e) => (e as { text: string }).text);
  const aiLines = new Set(replies.flatMap((t) => t.split("\n")).map(norm).filter((l) => l.length >= 4));
  const lines = pasted.split("\n").map(norm).filter((l) => l.length >= 4);
  if (!lines.length) return replies.some((t) => t.includes(pasted.trim()));
  return lines.filter((l) => aiLines.has(l)).length / lines.length >= 0.5;
}

const CONSOLE_BAR = 37; // px: the console's tab bar, which stays visible when collapsed

export function CodeWorkspace(p: Props) {
  const [tab, setTabState] = useState<Tab>(p.lastSubmit ? "results" : p.ai ? "ai" : p.strict ? "custom" : "results");
  const [aiLog, setAiLog] = useState<AiLogEntry[]>(p.ai?.log ?? []);
  const aiLogRef = useRef(aiLog);
  aiLogRef.current = aiLog;
  const editorRef = useRef<MonacoEditor | null>(null);
  const codeRef = useRef(p.code);
  codeRef.current = p.code;
  const sessionRef = useRef(p.sessionId);
  const pasteSub = useRef<{ dispose(): void } | null>(null);
  useEffect(() => () => pasteSub.current?.dispose(), []);

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    if (!p.ai || p.readOnly) return;
    // Pastes into the editor are part of the AI-usage record (did it come from the assistant?).
    pasteSub.current = editor.onDidPaste((e) => {
      const text = editor.getModel()?.getValueInRange(e.range) ?? "";
      if (text.trim().length < 10) return;
      void api
        .aiEvent(sessionRef.current, { kind: "paste", code: text, fromAi: fromAi(text, aiLogRef.current) })
        .then(({ entry }) => setAiLog((l) => [...l, entry]))
        .catch(() => {});
    });
  };

  const insertCode = useCallback((code: string) => {
    const ed = editorRef.current;
    if (!ed) return p.onCode(codeRef.current + "\n" + code);
    const sel = ed.getSelection();
    if (sel) ed.executeEdits("ai-assistant", [{ range: sel, text: code, forceMoveMarkers: true }]);
    ed.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const replaceCode = useCallback((code: string) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return p.onCode(code);
    ed.executeEdits("ai-assistant", [{ range: model.getFullModelRange(), text: code }]);
    ed.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const getCode = useCallback(() => codeRef.current, []);
  const consoleRef = usePanelRef();
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const { defaultLayout, onLayoutChanged, userAction } = usePersistentLayout("code-console");
  /** Switching tabs (or new results arriving) always reveals the console. */
  const setTab = (t: Tab) => {
    setTabState(t);
    if (consoleRef.current?.isCollapsed()) {
      userAction();
      consoleRef.current.expand();
    }
  };
  const toggleConsole = () => {
    const c = consoleRef.current;
    if (!c) return;
    userAction();
    if (c.isCollapsed()) c.expand();
    else c.collapse();
  };
  const [custom, setCustom] = useState("");
  const [includePublic, setIncludePublic] = useState(!p.strict);
  const [result, setResult] = useState<RunResult | null>(p.lastSubmit ?? null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isClass = p.question.signature?.kind === "class";

  const parseCustom = (): TestCase[] => {
    return custom
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("//"))
      .map((l, i) => {
        let v: unknown;
        try {
          v = JSON.parse(l);
        } catch {
          throw new Error(`Custom input line ${i + 1} is not valid JSON: ${l}`);
        }
        if (isClass) {
          const o = v as { ops?: string[]; args?: unknown[] };
          if (!o || !Array.isArray(o.ops) || !Array.isArray(o.args)) throw new Error(`Line ${i + 1}: expected {"ops": [...], "args": [...]}`);
          return { ops: o.ops, args: o.args as unknown[][] };
        }
        if (!Array.isArray(v)) throw new Error(`Line ${i + 1}: expected a JSON array of arguments, e.g. [[1,2,3], 4]`);
        return { args: v };
      });
  };

  const run = async () => {
    setError(null);
    let cases: TestCase[];
    try {
      cases = parseCustom();
    } catch (e) {
      setError((e as Error).message);
      setTab("custom");
      return;
    }
    setRunning(true);
    try {
      const r = await api.run(p.sessionId, { language: p.language, code: p.code, includePublic, custom: cases });
      setResult(r.result);
      setTab("results");
      p.onRan(r.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const lang = LANGUAGES.find((l) => l.id === p.language) ?? LANGUAGES[0];
  const placeholder = isClass
    ? `One test per line. The first op is the constructor:\n{"ops": ["${p.question.signature?.entry.javascript}", "put", "get"], "args": [[2], [1, 1], [1]]}`
    : `One test per line, as a JSON array of arguments:\n${p.question.publicTests?.[0] ? fmtJson(p.question.publicTests[0].args) : "[[1, 2, 3], 4]"}`;

  return (
    <div className="code-ws">
      <div className="toolbar">
        <select value={p.language} disabled={p.readOnly} onChange={(e) => p.onLanguage(e.target.value as Language)}>
          {LANGUAGES.filter((l) => p.question.languages?.includes(l.id) ?? true).map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <div className="spacer" />
        {!p.readOnly && (
          <>
            {!p.strict && (
              <label className="check small">
                <input type="checkbox" checked={includePublic} onChange={(e) => setIncludePublic(e.target.checked)} /> sample tests
              </label>
            )}
            <button className="secondary" onClick={run} disabled={running}>
              {running ? "Running…" : "▶ Run"}
            </button>
          </>
        )}
      </div>
      <Group orientation="vertical" className="code-split" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      <Panel id="editor" minSize={120} className="editor">
        <Editor
          theme="vs-dark"
          language={lang.monaco}
          value={p.code}
          onMount={onMount}
          onChange={(v) => p.onCode(v ?? "")}
          options={{
            readOnly: p.readOnly,
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: lang.tabSize,
            insertSpaces: lang.insertSpaces,
            detectIndentation: false,
            automaticLayout: true,
            // No AI-ish autocomplete: closer to a real interview pad.
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            wordBasedSuggestions: "off",
          }}
        />
      </Panel>
      <Separator className="divider horizontal" onDoubleClick={toggleConsole} title="Drag to resize · double-click to collapse" />
      <Panel
        id="console"
        panelRef={consoleRef}
        defaultSize="38%"
        minSize={120}
        collapsible
        collapsedSize={CONSOLE_BAR}
        className="console"
        onResize={(sz) => setConsoleCollapsed(sz.inPixels <= CONSOLE_BAR + 1)}
      >
        <div className="tabs">
          <button className={tab === "results" ? "on" : ""} onClick={() => setTab("results")}>
            Results{result && result.total > 0 ? ` (${result.passed}/${result.total})` : ""}
          </button>
          {!p.readOnly && (
            <button className={tab === "custom" ? "on" : ""} onClick={() => setTab("custom")}>
              Custom input
            </button>
          )}
          {p.ai && (
            <button className={tab === "ai" ? "on" : ""} onClick={() => setTab("ai")}>
              ✦ AI assistant{aiLog.length ? ` (${aiLog.filter((e) => e.kind === "prompt").length})` : ""}
            </button>
          )}
          <div className="spacer" />
          <button className="collapse-btn" onClick={toggleConsole} title={consoleCollapsed ? "Show console" : "Collapse console"} aria-label={consoleCollapsed ? "Show console" : "Collapse console"}>
            {consoleCollapsed ? "▴" : "▾"}
          </button>
        </div>
        <div className="console-body" style={consoleCollapsed ? { display: "none" } : undefined}>
          {error && <div className="banner error small">{error}</div>}
          {tab === "ai" && p.ai ? (
            <AssistantPanel
              sessionId={p.sessionId}
              readOnly={p.readOnly}
              policy={p.ai.policy}
              language={p.language}
              log={aiLog}
              onLog={setAiLog}
              getCode={getCode}
              onInsert={insertCode}
              onReplace={replaceCode}
            />
          ) : tab === "custom" && !p.readOnly ? (
            <div className="custom">
              <textarea value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={placeholder} spellCheck={false} />
              <p className="muted small">
                {p.strict
                  ? "Strict mode: you'll see your program's output, but no expected answers. Reason about correctness yourself."
                  : "Expected output for custom inputs comes from a reference solution."}
              </p>
            </div>
          ) : (
            <Results result={result} />
          )}
        </div>
      </Panel>
      </Group>
    </div>
  );
}

export function Results({ result }: { result: RunResult | null }) {
  if (!result) return <p className="muted small">Run your code to see results here.</p>;
  if (result.compileError)
    return (
      <div>
        <div className="result-head fail">Did not run</div>
        <pre className="err">{result.compileError}</pre>
      </div>
    );
  return (
    <div>
      <div className={`result-head ${result.total === 0 ? "" : result.passed === result.total ? "pass" : "fail"}`}>
        {result.total > 0 ? `${result.passed} / ${result.total} passed` : "Ran"} · {result.durationMs} ms
        {result.redacted && <span className="muted small"> · strict mode: details are revealed after evaluation</span>}
      </div>
      {result.cases.map((c) => (
        <CaseRow key={`${c.kind}-${c.index}`} c={c} />
      ))}
      {result.stderr && <pre className="err small">{result.stderr}</pre>}
    </div>
  );
}

function CaseRow({ c }: { c: CaseResult }) {
  const [open, setOpen] = useState(c.passed === false || !!c.error);
  const icon = c.error ? "✗" : c.passed === undefined ? "•" : c.passed ? "✓" : "✗";
  return (
    <div className={`case ${c.passed === false || c.error ? "fail" : c.passed ? "pass" : ""}`}>
      <button className="case-head" onClick={() => setOpen(!open)}>
        <span className="icon">{icon}</span>
        <span>
          {c.part !== undefined && <span className="muted">part {c.part + 1} · </span>}
          {c.kind} {c.name ? `· ${c.name}` : `#${c.index + 1}`}
        </span>
        {c.ms !== undefined && <span className="muted small">{c.ms.toFixed(1)} ms</span>}
      </button>
      {open && (
        <div className="case-body">
          {c.ops && (
            <div>
              <label>ops</label>
              <code>{fmtJson(c.ops)}</code>
            </div>
          )}
          <div>
            <label>input</label>
            <code>{fmtJson(c.args)}</code>
          </div>
          {c.error ? (
            <div>
              <label>error</label>
              <pre className="err">{c.error}</pre>
            </div>
          ) : (
            <div>
              <label>output</label>
              <code>{fmtJson(c.output)}</code>
            </div>
          )}
          {c.expected !== undefined && (
            <div>
              <label>expected</label>
              <code>{fmtJson(c.expected)}</code>
            </div>
          )}
          {c.stdout && (
            <div>
              <label>stdout</label>
              <pre>{c.stdout}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
