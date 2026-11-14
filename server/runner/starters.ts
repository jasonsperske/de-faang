// Starter code generated from a typed signature, for every language, and the logic that adds a
// later part's stub to the candidate's file when a multipart question moves on.

import type { Language } from "../../shared/types.ts";
import { parseType, type MethodSig, type Param, type TypedSignature, type TypeRef } from "./signature.ts";
import { isTypedLanguage, typedStarterPieces, type StarterPieces } from "./typed.ts";

type ScriptLanguage = "python" | "javascript" | "typescript";

const PY: Record<TypeRef["base"], string> = { int: "int", long: "int", double: "float", bool: "bool", string: "str", void: "None" };
const TS: Record<TypeRef["base"], string> = { int: "number", long: "number", double: "number", bool: "boolean", string: "string", void: "void" };

function pyType(s: string): string {
  const t = parseType(s);
  let out = PY[t.base];
  for (let i = 0; i < t.dims; i++) out = `List[${out}]`;
  return out;
}
const tsType = (s: string) => {
  const t = parseType(s);
  return TS[t.base] + "[]".repeat(t.dims);
};

function scriptStarterPieces(lang: ScriptLanguage, sig: TypedSignature, entry: string): StarterPieces {
  const methods = Object.entries(sig.methods ?? {}) as [string, MethodSig][];
  if (lang === "python") {
    const params = (ps: Param[]) => ps.map((p) => `, ${p.name}: ${pyType(p.type)}`).join("");
    const header = "from typing import List\n\n\n";
    if (sig.kind === "function") {
      const ps = sig.params!.map((p) => `${p.name}: ${pyType(p.type)}`).join(", ");
      return { header, body: `def ${entry}(${ps}) -> ${pyType(sig.returns!)}:\n    pass\n` };
    }
    const ms = methods.map(([op, m]) => `    def ${op}(self${params(m.params)}) -> ${pyType(m.returns)}:\n        pass`);
    return { header, body: `class ${entry}:\n    def __init__(self${params(sig.init!)}):\n        pass\n\n${ms.join("\n\n")}\n` };
  }
  const typed = lang === "typescript";
  const params = (ps: Param[]) => ps.map((p) => (typed ? `${p.name}: ${tsType(p.type)}` : p.name)).join(", ");
  const ret = (s: string) => (typed ? `: ${tsType(s)}` : "");
  const doc = (ps: Param[], r: string, pad = "") =>
    typed ? "" : `${pad}/**\n${ps.map((p) => `${pad} * @param {${tsType(p.type)}} ${p.name}\n`).join("")}${pad} * @return {${tsType(r)}}\n${pad} */\n`;
  if (sig.kind === "function") return { header: "", body: `${doc(sig.params!, sig.returns!)}function ${entry}(${params(sig.params!)})${ret(sig.returns!)} {\n\n}\n` };
  const ms = methods.map(([op, m]) => `${doc(m.params, m.returns, "  ")}  ${op}(${params(m.params)})${ret(m.returns)} {\n\n  }`);
  return { header: "", body: `class ${entry} {\n  constructor(${params(sig.init!)}) {\n\n  }\n\n${ms.join("\n\n")}\n}\n` };
}

export function starterPieces(lang: Language, sig: TypedSignature, entry: string): StarterPieces {
  return isTypedLanguage(lang) ? typedStarterPieces(lang, sig, entry) : scriptStarterPieces(lang, sig, entry);
}

export function generateStarter(lang: Language, sig: TypedSignature, entry: string): string {
  const p = starterPieces(lang, sig, entry);
  return p.header + p.body;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether the candidate's code already defines this part's entry point (so there's nothing to add). */
export function definesEntry(lang: Language, code: string, kind: "function" | "class", entry: string): boolean {
  const e = esc(entry);
  const patterns: RegExp[] =
    kind === "class"
      ? {
          python: [new RegExp(`^\\s*class\\s+${e}\\b`, "m")],
          javascript: [new RegExp(`\\bclass\\s+${e}\\b`)],
          typescript: [new RegExp(`\\bclass\\s+${e}\\b`)],
          java: [new RegExp(`\\bclass\\s+${e}\\b`)],
          cpp: [new RegExp(`\\b(class|struct)\\s+${e}\\b`)],
          go: [new RegExp(`\\btype\\s+${e}\\s+struct\\b`)],
          rust: [new RegExp(`\\bstruct\\s+${e}\\b`)],
          c: [new RegExp(`\\}\\s*${e}\\s*;`), new RegExp(`\\bstruct\\s+${e}\\b`)],
        }[lang]
      : {
          python: [new RegExp(`^\\s*def\\s+${e}\\s*\\(`, "m")],
          javascript: [new RegExp(`\\bfunction\\s+${e}\\b`), new RegExp(`\\b(const|let|var)\\s+${e}\\b`)],
          typescript: [new RegExp(`\\bfunction\\s+${e}\\b`), new RegExp(`\\b(const|let|var)\\s+${e}\\b`)],
          java: [new RegExp(`\\b${e}\\s*\\(`)],
          cpp: [new RegExp(`\\b${e}\\s*\\(`)],
          go: [new RegExp(`\\bfunc\\s+${e}\\s*\\(`)],
          rust: [new RegExp(`\\bfn\\s+${e}\\s*[(<]`)],
          c: [new RegExp(`\\b${e}\\s*\\(`)],
        }[lang];
  return patterns.some((re) => re.test(code));
}

/**
 * Finds the index of the `}` that closes `class Solution` in Java or C++ code, skipping braces
 * inside strings, character literals and comments. Returns -1 when there's no such class.
 */
export function solutionClassEnd(code: string): number {
  const m = /\bclass\s+Solution\b[^{;]*\{/.exec(code);
  if (!m) return -1;
  let depth = 1;
  for (let i = m.index + m[0].length; i < code.length; i++) {
    const c = code[i];
    if (c === "/" && code[i + 1] === "/") {
      i = code.indexOf("\n", i);
      if (i === -1) return -1;
    } else if (c === "/" && code[i + 1] === "*") {
      i = code.indexOf("*/", i + 2);
      if (i === -1) return -1;
      i++;
    } else if (c === '"' || c === "'") {
      for (i++; i < code.length && code[i] !== c; i++) if (code[i] === "\\") i++;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return -1;
}

/**
 * Adds a part's stub to the candidate's code: Java and C++ methods go inside the existing
 * `class Solution`; everything else is appended to the file. Code that already defines the entry
 * point is returned unchanged (e.g. a later part that extends the same class).
 */
export function addPartStub(lang: Language, code: string, sig: TypedSignature, entry: string): string {
  if (definesEntry(lang, code, sig.kind, entry)) return code;
  const pieces = starterPieces(lang, sig, entry);
  if (pieces.member && (lang === "java" || lang === "cpp")) {
    const end = solutionClassEnd(code);
    if (end !== -1) {
      const before = code.slice(0, end).replace(/\s*$/, "");
      return `${before}\n\n${pieces.member}${code.slice(end)}`;
    }
  }
  const trimmed = code.replace(/\s*$/, "");
  if (!trimmed) return pieces.header + pieces.body;
  return `${trimmed}${lang === "python" ? "\n\n\n" : "\n\n"}${pieces.body}`;
}
