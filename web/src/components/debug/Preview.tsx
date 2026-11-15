import { useEffect, useRef, useState } from "react";
import type { AppControls } from "./useAppStatus";

const STATE_LABEL = { stopped: "Stopped", starting: "Starting…", running: "Running", failed: "Failed" } as const;

/** The running app in an iframe. Hot reloading updates it as files are saved. */
export function Preview({ app, readOnly }: { app: AppControls; readOnly: boolean }) {
  const { status } = app;
  const [nonce, setNonce] = useState(0);
  // Load the page once the server answers (it isn't there while starting).
  const ready = status?.state === "running" && status.url;
  const [src, setSrc] = useState<string | undefined>();
  useEffect(() => {
    if (!ready) return;
    setSrc(status!.url);
    setNonce((n) => n + 1); // fresh page after a (re)start
  }, [ready, status?.url]);

  return (
    <div className="preview">
      <div className="preview-bar">
        <span className={`app-dot ${status?.state ?? "stopped"}`} />
        <span className="small">{status ? STATE_LABEL[status.state] : "…"}</span>
        {status?.url && (
          <a className="small mono" href={status.url} target="_blank" rel="noreferrer" title="Open the app in a new browser tab">
            {status.url} ↗
          </a>
        )}
        <div className="spacer" />
        {ready && (
          <button className="ghost small" onClick={() => setNonce((n) => n + 1)} title="Reload the page">
            ↻ Reload
          </button>
        )}
        {!readOnly && (
          <button className="ghost small" disabled={app.busy} onClick={() => void (status?.state === "stopped" ? app.start() : app.restart())} title="Restart the dev server (API and web)">
            {status?.state === "stopped" ? "▶ Start app" : "⟲ Restart app"}
          </button>
        )}
      </div>
      {(app.error || status?.message) && <div className="banner error small">{app.error ?? status?.message}</div>}
      {src ? (
        <iframe key={nonce} className="preview-frame" src={src} title="App preview" />
      ) : (
        <div className="preview-empty muted small">
          {readOnly
            ? "The round is over, so the app has stopped."
            : status?.state === "failed"
              ? "The app didn't start. Check the Logs tab."
              : status?.mode === "docker"
                ? "Starting the app in Docker. The first start builds its image, which can take a few minutes."
                : "Starting the app…"}
        </div>
      )}
    </div>
  );
}

/** The dev server's output (API and Vite), newest at the bottom. */
export function Logs({ app }: { app: AppControls }) {
  const ref = useRef<HTMLPreElement>(null);
  const logs = app.status?.logs ?? "";
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);
  return (
    <pre ref={ref} className="term-out logs">
      {logs || "No output yet."}
    </pre>
  );
}
