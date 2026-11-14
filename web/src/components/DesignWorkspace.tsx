import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import Editor from "@monaco-editor/react";
import { summarizeDiagram } from "../lib/diagram";
import type { DesignWorkspace as DesignWs } from "../lib/api";
import { Markdown } from "./Markdown";

export interface DesignHandle {
  /** Current notes + scene + text summary of the diagram (cheap; sent with every chat turn). */
  snapshot(): DesignWs;
  /** Same, plus a PNG export of the whiteboard (used at submit). */
  snapshotWithImage(): Promise<DesignWs>;
}

interface Props {
  markdown: string;
  scene?: unknown;
  readOnly: boolean;
  onChange: () => void;
}

type Scene = { elements: readonly any[]; appState?: Record<string, unknown>; files?: Record<string, unknown> };

export const DesignWorkspace = forwardRef<DesignHandle, Props>(function DesignWorkspace({ markdown, scene, readOnly, onChange }, ref) {
  const [tab, setTab] = useState<"board" | "notes">("board");
  const [notes, setNotes] = useState(markdown);
  const [preview, setPreview] = useState(false);
  const sceneRef = useRef<Scene>((scene as Scene) ?? { elements: [] });
  const notesRef = useRef(markdown);

  const initialData = useMemo(() => {
    const s = scene as Scene | undefined;
    return {
      elements: s?.elements ?? [],
      appState: { viewBackgroundColor: "#ffffff", ...(s?.appState ?? {}), collaborators: new Map() },
      files: s?.files as any,
      scrollToContent: true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = (): DesignWs => {
    const s = sceneRef.current;
    return {
      markdown: notesRef.current,
      scene: { elements: s.elements, appState: { viewBackgroundColor: s.appState?.viewBackgroundColor ?? "#ffffff" }, files: s.files ?? {} },
      diagramSummary: summarizeDiagram(s.elements),
    };
  };

  useImperativeHandle(ref, () => ({
    snapshot: current,
    async snapshotWithImage() {
      const ws = current();
      const live = sceneRef.current.elements.filter((e) => !e.isDeleted);
      if (!live.length) return ws;
      const blob = await exportToBlob({
        elements: live,
        appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
        files: (sceneRef.current.files ?? {}) as any,
        mimeType: "image/png",
        exportPadding: 24,
      });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { ...ws, png: btoa(bin) };
    },
  }));

  return (
    <div className="design-ws">
      <div className="toolbar">
        <div className="tabs inline">
          <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>
            Whiteboard
          </button>
          <button className={tab === "notes" ? "on" : ""} onClick={() => setTab("notes")}>
            Notes (markdown)
          </button>
        </div>
        <div className="spacer" />
        {tab === "notes" && (
          <label className="check small">
            <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> preview
          </label>
        )}
      </div>
      {/* Keep both mounted so the canvas state survives tab switches. */}
      <div className="board" style={{ display: tab === "board" ? "block" : "none" }}>
        <Excalidraw
          initialData={initialData as any}
          viewModeEnabled={readOnly}
          theme="light"
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: { saveFileToDisk: true } } }}
          onChange={(elements, appState, files) => {
            const prev = sceneRef.current.elements;
            sceneRef.current = { elements, appState: appState as any, files: files as any };
            // onChange fires on every pointer move; only autosave when elements change.
            if (elements !== prev) onChange();
          }}
        />
      </div>
      <div className="notes" style={{ display: tab === "notes" ? "flex" : "none" }}>
        <div className="notes-editor" style={{ display: preview ? "none" : "block" }}>
          <Editor
            theme="vs-dark"
            language="markdown"
            value={notes}
            onChange={(v) => {
              setNotes(v ?? "");
              notesRef.current = v ?? "";
              onChange();
            }}
            options={{ readOnly, fontSize: 14, minimap: { enabled: false }, wordWrap: "on", automaticLayout: true, lineNumbers: "off" }}
          />
        </div>
        {preview && (
          <div className="notes-preview">
            <Markdown>{notes}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
});
