import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import type { ActivityEntry, AiLogEntry, RunResult } from "../../../../shared/types";
import { api } from "../../lib/api";
import { usePersistentLayout } from "../../lib/layout";
import { AssistantPanel } from "../AssistantPanel";
import { fromAi, Results } from "../CodeWorkspace";
import { Logs, Preview } from "./Preview";
import { Terminal } from "./Terminal";
import { useAppStatus } from "./useAppStatus";
import type { Project } from "./useProject";

type Tab = "preview" | "terminal" | "logs" | "checks" | "ai";
type MonacoEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

const MONACO_LANG: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", ts: "typescript", tsx: "typescript",
  json: "json", css: "css", html: "html", md: "markdown", sql: "sql", yml: "yaml", yaml: "yaml", sh: "shell",
};
const langOf = (path: string) => MONACO_LANG[path.split(".").pop()?.toLowerCase() ?? ""] ?? "plaintext";

const CONSOLE_BAR = 37;

interface Props {
  sessionId: string;
  project: Project;
  readOnly: boolean;
  /** Sample checks are available (not in strict mode). */
  checks: boolean;
  activity: ActivityEntry[];
  lastSubmit?: RunResult;
  onRan: (r: RunResult) => void;
  /** AI-assisted rounds: the assistant's log and helpfulness policy. */
  ai?: { log: AiLogEntry[]; policy?: string };
}

/**
 * The center pane of a debugging round: editor tabs for the project's open files, and a console
 * with the running app, a terminal, the dev server's logs, check results, and the AI assistant.
 */
export function DebugWorkspace(p: Props) {
  const { project } = p;
  const app = useAppStatus(p.sessionId, p.readOnly);
  const [tab, setTabState] = useState<Tab>(p.lastSubmit ? "checks" : "preview");
  const [result, setResult] = useState<RunResult | null>(p.lastSubmit ?? null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLog, setAiLog] = useState<AiLogEntry[]>(p.ai?.log ?? []);
  const editorRef = useRef<MonacoEditor | null>(null);
  const consoleRef = usePanelRef();
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const { defaultLayout, onLayoutChanged, userAction } = usePersistentLayout("debug-console");
  const active = project.activeFile;
  const activeRef = useRef(active);
  activeRef.current = active;

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

  // The project's own code (imports of react, JSX in .js files) isn't type-checked; only syntax errors show.
  const restoreDiagnostics = useRef<(() => void) | null>(null);
  const aiLogRef = useRef(aiLog);
  aiLogRef.current = aiLog;
  const onMount: OnMount = (editor, monaco: Monaco) => {
    editorRef.current = editor;
    if (p.ai && !p.readOnly) {
      // Pastes into the editor are part of the AI-usage record (did it come from the assistant?).
      editor.onDidPaste((e) => {
        const text = editor.getModel()?.getValueInRange(e.range) ?? "";
        if (text.trim().length < 10) return;
        void api
          .aiEvent(p.sessionId, { kind: "paste", code: text, fromAi: fromAi(text, aiLogRef.current) })
          .then(({ entry }) => setAiLog((l) => [...l, entry]))
          .catch(() => {});
      });
    }
    const ts = (monaco.languages as any).typescript;
    if (ts && !restoreDiagnostics.current) {
      const defaults = [ts.javascriptDefaults, ts.typescriptDefaults];
      const before = defaults.map((d: any) => d.getDiagnosticsOptions());
      const compilerBefore = defaults.map((d: any) => d.getCompilerOptions());
      defaults.forEach((d: any) => {
        d.setDiagnosticsOptions({ ...d.getDiagnosticsOptions(), noSemanticValidation: true });
        d.setCompilerOptions({ ...d.getCompilerOptions(), jsx: ts.JsxEmit?.Preserve ?? 1, allowJs: true });
      });
      restoreDiagnostics.current = () =>
        defaults.forEach((d: any, i: number) => {
          d.setDiagnosticsOptions(before[i]);
          d.setCompilerOptions(compilerBefore[i]);
        });
    }
  };
  useEffect(() => () => restoreDiagnostics.current?.(), []);

  const runChecks = async () => {
    setError(null);
    setRunning(true);
    try {
      await project.flush();
      const r = await api.checks(p.sessionId);
      setResult(r.result);
      setTab("checks");
      p.onRan(r.result);
    } catch (e) {
      setError((e as Error).message);
      setTab("checks");
    } finally {
      setRunning(false);
    }
  };

  const insertCode = useCallback((code: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (sel) ed.executeEdits("ai-assistant", [{ range: sel, text: code, forceMoveMarkers: true }]);
    ed.focus();
  }, []);
  const replaceCode = useCallback((code: string) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;
    ed.executeEdits("ai-assistant", [{ range: model.getFullModelRange(), text: code }]);
    ed.focus();
  }, []);
  const getCode = useCallback(() => activeRef.current?.content ?? "", []);
  const getFile = useCallback(() => activeRef.current?.path, []);

  return (
    <div className="code-ws debug-ws">
      <div className="toolbar file-tabs">
        <div className="file-tab-list">
          {project.open.map((f) => (
            <div key={f.path} className={`file-tab ${f.path === project.active ? "on" : ""}`} title={f.path}>
              <button className="file-tab-name" onClick={() => void project.openFile(f.path)}>
                {f.path.split("/").pop()}
                {f.dirty && <span className="tree-dot" aria-label="unsaved" />}
              </button>
              <button className="file-tab-close" onClick={() => project.closeFile(f.path)} aria-label={`Close ${f.path}`}>
                ×
              </button>
            </div>
          ))}
          {project.open.length === 0 && <span className="muted small">Open a file from the Files tab.</span>}
        </div>
        <div className="spacer" />
        {!p.readOnly && p.checks && (
          <button className="secondary" onClick={runChecks} disabled={running} title="Run the sample checks against your copy of the project">
            {running ? "Checking…" : "✓ Run checks"}
          </button>
        )}
      </div>
      <Group orientation="vertical" className="code-split" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
        <Panel id="editor" minSize={120} className="editor">
          {active ? (
            <>
              <div className="file-path muted small">{active.path}</div>
              <Editor
                theme="vs-dark"
                path={`file:///project/${active.path}`}
                language={langOf(active.path)}
                value={active.content}
                onMount={onMount}
                onChange={(v) => project.edit(active.path, v ?? "")}
                options={{
                  readOnly: p.readOnly,
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  insertSpaces: true,
                  automaticLayout: true,
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  wordBasedSuggestions: "off",
                }}
              />
            </>
          ) : (
            <div className="preview-empty muted small">No file open.</div>
          )}
        </Panel>
        <Separator className="divider horizontal" onDoubleClick={toggleConsole} title="Drag to resize · double-click to collapse" />
        <Panel
          id="console"
          panelRef={consoleRef}
          defaultSize="45%"
          minSize={120}
          collapsible
          collapsedSize={CONSOLE_BAR}
          className="console"
          onResize={(sz) => setConsoleCollapsed(sz.inPixels <= CONSOLE_BAR + 1)}
        >
          <div className="tabs">
            <button className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}>
              Preview
            </button>
            <button className={tab === "terminal" ? "on" : ""} onClick={() => setTab("terminal")}>
              Terminal
            </button>
            <button className={tab === "logs" ? "on" : ""} onClick={() => setTab("logs")}>
              Logs
            </button>
            {(p.checks || result) && (
              <button className={tab === "checks" ? "on" : ""} onClick={() => setTab("checks")}>
                Checks{result && result.total > 0 ? ` (${result.passed}/${result.total})` : ""}
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
          {/* Every tab stays mounted, so the app keeps its state and a running command keeps streaming. */}
          <div className="console-body flush" style={consoleCollapsed ? { display: "none" } : undefined}>
            <div className="console-tab" hidden={tab !== "preview"}>
              <Preview app={app} readOnly={p.readOnly} />
            </div>
            <div className="console-tab" hidden={tab !== "terminal"}>
              <Terminal sessionId={p.sessionId} initial={p.activity} readOnly={p.readOnly} onCommandDone={() => void project.reloadOpen()} />
            </div>
            <div className="console-tab" hidden={tab !== "logs"}>
              <Logs app={app} />
            </div>
            <div className="console-tab padded" hidden={tab !== "checks"}>
              {error && <div className="banner error small">{error}</div>}
              {result || !p.checks ? <Results result={result} /> : <p className="muted small">Run checks to test your fix against the sample data from the bug report.</p>}
            </div>
            {p.ai && (
              <div className="console-tab padded" hidden={tab !== "ai"}>
                <AssistantPanel
                  sessionId={p.sessionId}
                  readOnly={p.readOnly}
                  policy={p.ai.policy}
                  log={aiLog}
                  onLog={setAiLog}
                  getCode={getCode}
                  getFile={getFile}
                  onInsert={insertCode}
                  onReplace={replaceCode}
                />
              </div>
            )}
          </div>
        </Panel>
      </Group>
    </div>
  );
}
