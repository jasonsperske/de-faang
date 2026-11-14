// Bundle Monaco locally instead of loading it from a CDN, so the editor works offline.
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === "typescript" || label === "javascript") return new TsWorker();
    return new EditorWorker();
  },
};

// Starters declare functions that are intentionally incomplete; don't flag "not all code paths return".
const ts = (monaco.languages as any).typescript;
if (ts) {
  for (const d of [ts.typescriptDefaults, ts.javascriptDefaults]) {
    d.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false, diagnosticCodesToIgnore: [2355, 2366, 7027, 6133] });
  }
}

loader.config({ monaco });

// Monaco's built-in Python mode doesn't indent after a colon; add that so the pad feels like a real editor.
monaco.languages.setLanguageConfiguration("python", {
  comments: { lineComment: "#", blockComment: ['"""', '"""'] },
  brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"', notIn: ["string"] },
    { open: "'", close: "'", notIn: ["string", "comment"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  onEnterRules: [
    { beforeText: /:\s*(#.*)?$/, action: { indentAction: monaco.languages.IndentAction.Indent } },
    { beforeText: /^\s*(return|pass|break|continue|raise)\b.*$/, action: { indentAction: monaco.languages.IndentAction.Outdent } },
  ],
  folding: { offSide: true },
});
