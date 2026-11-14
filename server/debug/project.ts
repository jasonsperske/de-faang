// Debugging questions: the candidate's copy of the project (sessions/<id>/workspace/project/), its
// file listing, safe path handling, and a unified diff against the original.

import fs from "node:fs";
import path from "node:path";
import type { ProjectFile } from "../../shared/types.ts";
import { SESSIONS_DIR } from "../paths.ts";

/** Folders that are generated or installed, never part of the candidate's work. */
const IGNORED_DIRS = new Set(["node_modules", ".vite", "dist", ".git", "coverage"]);
/** Files the browser lists but doesn't open, and the diff skips (the SQLite database and its journals). */
const BINARY_RE = /\.(db|sqlite|sqlite3|db-wal|db-shm|db-journal|png|jpe?g|gif|ico|webp|woff2?|ttf|zip|gz)$/i;
export const MAX_FILE_BYTES = 512 * 1024;

export const projectDir = (sessionId: string) => path.join(SESSIONS_DIR, sessionId, "workspace", "project");

export function copyProject(from: string, to: string) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(from, src);
      return !rel || !rel.split(path.sep).some((seg) => IGNORED_DIRS.has(seg));
    },
  });
}

export function listFiles(root: string): ProjectFile[] {
  const out: ProjectFile[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name)) walk(path.join(dir, e.name));
      } else if (e.isFile()) {
        const abs = path.join(dir, e.name);
        const rel = path.relative(root, abs).split(path.sep).join("/");
        const size = fs.statSync(abs).size;
        out.push({ path: rel, size, ...(BINARY_RE.test(e.name) || size > MAX_FILE_BYTES ? { binary: true } : {}) });
      }
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}

const bad = (msg: string) => Object.assign(new Error(msg), { statusCode: 400 });

/** Resolves a project-relative path, refusing anything that escapes the project or touches an ignored folder. */
export function resolveInProject(root: string, rel: string): string {
  const clean = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean || clean.split("/").some((seg) => seg === ".." || seg === "" || seg === ".")) throw bad(`Bad path: ${rel}`);
  if (clean.split("/").some((seg) => IGNORED_DIRS.has(seg))) throw bad(`${rel} is in a generated folder`);
  const abs = path.resolve(root, clean);
  if (path.relative(root, abs).startsWith("..") || path.isAbsolute(path.relative(root, abs))) throw bad(`Bad path: ${rel}`);
  return abs;
}

export function readProjectFile(root: string, rel: string): string {
  const abs = resolveInProject(root, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw Object.assign(new Error(`No file ${rel}`), { statusCode: 404 });
  if (BINARY_RE.test(abs) || fs.statSync(abs).size > MAX_FILE_BYTES) throw bad(`${rel} is a binary or very large file; inspect it from the terminal.`);
  return fs.readFileSync(abs, "utf8");
}

export function writeProjectFile(root: string, rel: string, content: string) {
  const abs = resolveInProject(root, rel);
  if (BINARY_RE.test(abs)) throw bad(`${rel} is a binary file`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  // Skip identical writes so the dev server doesn't reload for nothing.
  if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8") === content) return;
  fs.writeFileSync(abs, content);
}

export function deleteProjectFile(root: string, rel: string) {
  const abs = resolveInProject(root, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw Object.assign(new Error(`No file ${rel}`), { statusCode: 404 });
  fs.rmSync(abs);
}

// ---------------------------------------------------------------- diff

export interface FileChange {
  path: string;
  status: "added" | "deleted" | "modified";
  diff: string;
  added: string[];
}

const textFiles = (root: string) => new Map(listFiles(root).filter((f) => !f.binary).map((f) => [f.path, fs.readFileSync(path.join(root, f.path), "utf8")]));

/** Every text file the candidate added, deleted or changed, with a unified diff of each. */
export function projectChanges(originalRoot: string, currentRoot: string): FileChange[] {
  const before = textFiles(originalRoot);
  const after = textFiles(currentRoot);
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const out: FileChange[] = [];
  for (const p of paths) {
    const a = before.get(p);
    const b = after.get(p);
    if (a === b) continue;
    const { diff, added } = unifiedDiff(a ?? "", b ?? "", a === undefined ? "/dev/null" : `a/${p}`, b === undefined ? "/dev/null" : `b/${p}`);
    out.push({ path: p, status: a === undefined ? "added" : b === undefined ? "deleted" : "modified", diff, added });
  }
  return out;
}

export const changesDiff = (changes: FileChange[]) => changes.map((c) => c.diff).join("\n");

type Op = { t: " " | "-" | "+"; line: string };

/** Line diff via LCS, after trimming the common prefix and suffix (edits are usually small). */
function diffLines(a: string[], b: string[]): Op[] {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const A = a.slice(pre, a.length - suf);
  const B = b.slice(pre, b.length - suf);
  const ops: Op[] = a.slice(0, pre).map((line) => ({ t: " ", line }));
  if (A.length * B.length > 4_000_000) {
    // Too large for the DP table: show it as a replacement.
    ops.push(...A.map((line) => ({ t: "-" as const, line })), ...B.map((line) => ({ t: "+" as const, line })));
  } else {
    const n = A.length;
    const m = B.length;
    const L = new Uint32Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--) L[i * (m + 1) + j] = A[i] === B[j] ? L[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(L[(i + 1) * (m + 1) + j], L[i * (m + 1) + j + 1]);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) {
        ops.push({ t: " ", line: A[i++] });
        j++;
      } else if (i < n && (j === m || L[(i + 1) * (m + 1) + j] >= L[i * (m + 1) + j + 1])) ops.push({ t: "-", line: A[i++] });
      else ops.push({ t: "+", line: B[j++] });
    }
  }
  ops.push(...a.slice(a.length - suf).map((line) => ({ t: " " as const, line })));
  return ops;
}

const splitLines = (s: string) => (s === "" ? [] : s.replace(/\n$/, "").split("\n"));

export function unifiedDiff(a: string, b: string, nameA: string, nameB: string, context = 3): { diff: string; added: string[] } {
  const ops = diffLines(splitLines(a), splitLines(b));
  const changed = ops.map((o, i) => (o.t === " " ? -1 : i)).filter((i) => i >= 0);
  const out = [`--- ${nameA}`, `+++ ${nameB}`];
  let k = 0;
  while (k < changed.length) {
    const start = Math.max(0, changed[k] - context);
    let end = Math.min(ops.length, changed[k] + context + 1);
    while (k + 1 < changed.length && changed[k + 1] - context <= end) end = Math.min(ops.length, changed[++k] + context + 1);
    k++;
    let oldStart = 1;
    let newStart = 1;
    for (const o of ops.slice(0, start)) {
      if (o.t !== "+") oldStart++;
      if (o.t !== "-") newStart++;
    }
    const hunk = ops.slice(start, end);
    const oldLen = hunk.filter((o) => o.t !== "+").length;
    const newLen = hunk.filter((o) => o.t !== "-").length;
    out.push(`@@ -${oldLen ? oldStart : oldStart - 1},${oldLen} +${newLen ? newStart : newStart - 1},${newLen} @@`, ...hunk.map((o) => o.t + o.line));
  }
  return { diff: out.join("\n") + "\n", added: ops.filter((o) => o.t === "+").map((o) => o.line) };
}
