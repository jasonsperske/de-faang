import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type {
  ChatEntry,
  Evaluation,
  Language,
  RunResult,
  SessionConfig,
  SessionListItem,
  SessionState,
} from "../shared/types.ts";
import { LANGUAGES } from "../shared/types.ts";
import { SESSIONS_DIR } from "./paths.ts";
import { getQuestion, loadQuestions } from "./questions.ts";

/*
 * Session folder layout (everything under sessions/ is gitignored):
 *
 *   sessions/<date>_<time>_<question>_<rand>/
 *     session.json          state + config
 *     prompt.md             the question as presented
 *     transcript.jsonl      interviewer chat, one entry per line
 *     workspace/            live autosaved work (solution.<ext>, design.md, design.excalidraw, design.png)
 *     runs/run-NNN.json     every Run: code, language, results
 *     evidence/             frozen packet assembled at submit + follow-up answers
 *     evaluation.json       structured rubric evaluation
 *     report.md             human-readable feedback report
 */

const ID_RE = /^[\w.-]+$/;

export function sessionDir(id: string): string {
  if (!ID_RE.test(id)) throw Object.assign(new Error("Bad session id"), { statusCode: 400 });
  const dir = path.join(SESSIONS_DIR, id);
  if (!fs.existsSync(path.join(dir, "session.json"))) throw Object.assign(new Error(`No session ${id}`), { statusCode: 404 });
  return dir;
}

const write = (file: string, data: string | Buffer) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};
const writeJson = (file: string, data: unknown) => write(file, JSON.stringify(data, null, 2) + "\n");
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

export function createSession(questionId: string, config: SessionConfig): SessionState {
  const q = getQuestion(questionId);
  const now = new Date();
  const stamp = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  const id = `${stamp}_${questionId}_${randomBytes(2).toString("hex")}`;
  const dir = path.join(SESSIONS_DIR, id);
  fs.mkdirSync(path.join(dir, "evidence"), { recursive: true });
  fs.mkdirSync(path.join(dir, "workspace"), { recursive: true });

  const state: SessionState = {
    id,
    questionId,
    config,
    status: "in_progress",
    createdAt: now.toISOString(),
    hintsRequested: 0,
    runs: 0,
  };
  if (q.meta.type === "coding") {
    state.code = { ...q.starter };
    state.config.language ??= "python";
  } else {
    state.design = { markdown: "## Requirements\n\n## Estimates\n\n## API\n\n## Data model\n\n## High-level design\n\n## Deep dives & tradeoffs\n" };
  }
  write(path.join(dir, "prompt.md"), q.prompt);
  saveState(state);
  return state;
}

export function loadState(id: string): SessionState {
  return readJson<SessionState>(path.join(sessionDir(id), "session.json"));
}

export function saveState(state: SessionState) {
  writeJson(path.join(SESSIONS_DIR, state.id, "session.json"), state);
}

export function appendTranscript(id: string, entry: Omit<ChatEntry, "at">): ChatEntry {
  const full: ChatEntry = { ...entry, at: new Date().toISOString() };
  fs.appendFileSync(path.join(sessionDir(id), "transcript.jsonl"), JSON.stringify(full) + "\n");
  return full;
}

export function readTranscript(id: string): ChatEntry[] {
  const f = path.join(sessionDir(id), "transcript.jsonl");
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ChatEntry);
}

export function saveCode(state: SessionState, language: Language, code: string) {
  state.code = { ...state.code, [language]: code };
  state.config.language = language;
  const ext = LANGUAGES.find((l) => l.id === language)!.ext;
  write(path.join(SESSIONS_DIR, state.id, "workspace", `solution.${ext}`), code);
  saveState(state);
}

export function saveDesign(state: SessionState, markdown: string, scene: unknown, diagramSummary: string, png?: string) {
  state.design = { markdown, scene, diagramSummary };
  const ws = path.join(SESSIONS_DIR, state.id, "workspace");
  write(path.join(ws, "design.md"), markdown);
  if (scene) writeJson(path.join(ws, "design.excalidraw"), { type: "excalidraw", version: 2, source: "de-faang", ...(scene as object) });
  if (png) write(path.join(ws, "design.png"), Buffer.from(png, "base64"));
  saveState(state);
}

export function designPng(id: string): string | undefined {
  for (const f of [path.join(sessionDir(id), "evidence", "design.png"), path.join(sessionDir(id), "workspace", "design.png")]) {
    if (fs.existsSync(f)) return fs.readFileSync(f).toString("base64");
  }
  return undefined;
}

export interface RunRecord {
  n: number;
  at: string;
  language: Language;
  code: string;
  result: RunResult;
  submit?: boolean;
}

export function recordRun(state: SessionState, language: Language, code: string, result: RunResult, submit = false): RunRecord {
  if (!submit) state.runs += 1;
  const n = state.runs + (submit ? 1 : 0);
  const rec: RunRecord = { n, at: new Date().toISOString(), language, code, result, submit };
  const name = submit ? "submit.json" : `run-${String(n).padStart(3, "0")}.json`;
  writeJson(path.join(SESSIONS_DIR, state.id, "runs", name), rec);
  saveState(state);
  return rec;
}

export function listRuns(id: string): RunRecord[] {
  const dir = path.join(sessionDir(id), "runs");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .sort()
    .map((f) => readJson<RunRecord>(path.join(dir, f)));
}

export function lastSubmit(id: string): RunResult | undefined {
  const f = path.join(sessionDir(id), "runs", "submit.json");
  return fs.existsSync(f) ? readJson<RunRecord>(f).result : undefined;
}

export function evidencePath(id: string, name: string) {
  return path.join(sessionDir(id), "evidence", name);
}

export function writeEvidence(id: string, name: string, data: string | Buffer) {
  write(evidencePath(id, name), data);
}

export function transcriptMarkdown(entries: ChatEntry[]): string {
  const who = { candidate: "**Candidate**", interviewer: "**Interviewer**", event: "_Event_" } as const;
  return entries.map((e) => `${who[e.role]} (${e.at.slice(11, 19)}):\n\n${e.text}\n`).join("\n---\n\n");
}

export function saveEvaluation(id: string, evaluation: Evaluation, report: string) {
  writeJson(path.join(sessionDir(id), "evaluation.json"), evaluation);
  write(path.join(sessionDir(id), "report.md"), report);
}

export function loadEvaluation(id: string): Evaluation | undefined {
  const f = path.join(sessionDir(id), "evaluation.json");
  return fs.existsSync(f) ? readJson<Evaluation>(f) : undefined;
}

export function readReport(id: string): string | undefined {
  const f = path.join(sessionDir(id), "report.md");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : undefined;
}

export function listSessions(): SessionListItem[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const qs = loadQuestions();
  const items: SessionListItem[] = [];
  for (const name of fs.readdirSync(SESSIONS_DIR)) {
    const f = path.join(SESSIONS_DIR, name, "session.json");
    if (!fs.existsSync(f)) continue;
    try {
      const s = readJson<SessionState>(f);
      const ev = s.status === "evaluated" ? loadEvaluation(s.id) : undefined;
      items.push({
        id: s.id,
        questionId: s.questionId,
        title: qs.get(s.questionId)?.meta.title ?? s.questionId,
        status: s.status,
        createdAt: s.createdAt,
        config: s.config,
        decision: ev?.decision,
      });
    } catch {
      /* skip corrupt sessions */
    }
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
