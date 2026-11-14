import { useEffect, useRef, useState } from "react";
import type { ActivityEntry } from "../../../../shared/types";
import { streamTerminal } from "../../lib/api";

type Block = { command: string; output: string; exitCode?: number | null; timedOut?: boolean; running?: boolean };

const fromActivity = (a: ActivityEntry[]): Block[] =>
  a.flatMap((e) => (e.kind === "command" ? [{ command: e.command, output: e.output, exitCode: e.exitCode, timedOut: e.timedOut }] : []));

/**
 * A command line in the app's environment (its container with the Docker runner). Each command runs
 * from the project root; `cd` doesn't carry over and commands can't read keyboard input.
 */
export function Terminal({ sessionId, initial, readOnly, onCommandDone }: { sessionId: string; initial: ActivityEntry[]; readOnly: boolean; onCommandDone?: () => void }) {
  const [blocks, setBlocks] = useState<Block[]>(() => fromActivity(initial));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const history = useRef<string[]>(fromActivity(initial).map((b) => b.command));
  const histIdx = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const running = blocks.some((b) => b.running);

  useEffect(() => {
    const el = outRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [blocks]);
  useEffect(() => () => abort.current?.abort(), []);

  const run = async () => {
    const command = draft.trim();
    if (!command || running) return;
    if (command === "clear") {
      setBlocks([]);
      setDraft("");
      return;
    }
    setDraft("");
    setError(null);
    history.current.push(command);
    histIdx.current = null;
    setBlocks((b) => [...b, { command, output: "", running: true }]);
    const update = (fn: (b: Block) => Block) => setBlocks((bs) => bs.map((b, i) => (i === bs.length - 1 ? fn(b) : b)));
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const entry = await streamTerminal(sessionId, command, (out) => update((b) => ({ ...b, output: b.output + out })), ctrl.signal);
      update((b) => ({ ...b, running: false, exitCode: entry?.kind === "command" ? entry.exitCode : undefined, timedOut: entry?.kind === "command" ? entry.timedOut : undefined }));
    } catch (e) {
      const stopped = ctrl.signal.aborted;
      update((b) => ({ ...b, running: false, exitCode: null, output: b.output + (stopped ? "^C\n" : "") }));
      if (!stopped) setError((e as Error).message);
    } finally {
      abort.current = null;
      onCommandDone?.();
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void run();
    } else if (e.key === "c" && e.ctrlKey && running) {
      e.preventDefault();
      abort.current?.abort();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const h = history.current;
      if (!h.length) return;
      e.preventDefault();
      let i = histIdx.current ?? h.length;
      i = e.key === "ArrowUp" ? Math.max(0, i - 1) : Math.min(h.length, i + 1);
      histIdx.current = i;
      setDraft(i === h.length ? "" : h[i]);
    }
  };

  return (
    <div className="terminal" onClick={() => document.getElementById(`term-in-${sessionId}`)?.focus()}>
      <div className="term-out" ref={outRef}>
        {blocks.length === 0 && (
          <div className="muted">
            Commands run from the project's root folder{readOnly ? "" : ", in the app's environment"}. Try <code>ls</code>, <code>cat package.json</code> or{" "}
            <code>npm run db:query "SELECT name FROM sqlite_master"</code>. Each command starts fresh (<code>cd</code> doesn't carry over), and commands
            can't read keyboard input. Ctrl+C stops a running command; <code>clear</code> clears the screen.
          </div>
        )}
        {blocks.map((b, i) => (
          <div key={i} className="term-block">
            <div className="term-cmd">
              <span className="term-prompt">$</span> {b.command}
            </div>
            {b.output && <pre>{b.output}</pre>}
            {!b.running && b.exitCode !== 0 && b.exitCode !== undefined && (
              <div className="term-exit">{b.timedOut ? "timed out" : b.exitCode === null ? "stopped" : `exit code ${b.exitCode}`}</div>
            )}
          </div>
        ))}
        {error && <div className="banner error small">{error}</div>}
      </div>
      {!readOnly && (
        <div className="term-input">
          <span className="term-prompt">$</span>
          <input
            id={`term-in-${sessionId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={running ? "Running… (Ctrl+C to stop)" : "Type a command and press Enter"}
            spellCheck={false}
            autoComplete="off"
          />
          {running && (
            <button className="ghost small" onClick={() => abort.current?.abort()}>
              Stop
            </button>
          )}
        </div>
      )}
    </div>
  );
}
