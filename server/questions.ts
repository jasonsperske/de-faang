import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Language, QuestionSummary, QuestionView, Strictness, TestCase } from "../shared/types.ts";
import { LANGUAGES } from "../shared/types.ts";
import { ROOT } from "./paths.ts";

export const QUESTIONS_DIR = path.join(ROOT, "questions");

const LangRecord = z.object({ python: z.string(), javascript: z.string(), typescript: z.string() });

const QuestionMeta = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  type: z.enum(["coding", "system-design"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  durationMinutes: z.number().int().positive(),
  tags: z.array(z.string()),
  rubric: z.string(),
  signature: z
    .object({
      kind: z.enum(["function", "class"]),
      entry: LangRecord,
      /** exact: deep equality. unordered: top-level array order is ignored. */
      compare: z.enum(["exact", "unordered"]).default("exact"),
    })
    .optional(),
  followUps: z.array(z.string()).min(1),
  /** Private notes for the interviewer LLM. Never sent to the browser. */
  interviewer: z.object({
    approach: z.string(),
    hints: z.array(z.string()),
    pitfalls: z.array(z.string()).default([]),
    /** For system design: facts the interviewer reveals only when asked (scale, constraints). */
    facts: z.array(z.string()).default([]),
    deepDives: z.array(z.string()).default([]),
  }),
  resources: z.array(z.string()).default([]),
});
export type QuestionMeta = z.infer<typeof QuestionMeta>;

const TestCaseSchema = z.object({
  name: z.string().optional(),
  args: z.array(z.unknown()),
  ops: z.array(z.string()).optional(),
  expected: z.unknown(),
});
const TestsFile = z.object({ public: z.array(TestCaseSchema), hidden: z.array(TestCaseSchema) });

export interface Question {
  meta: QuestionMeta;
  dir: string;
  prompt: string;
  starter: Partial<Record<Language, string>>;
  tests?: { public: TestCase[]; hidden: TestCase[] };
  reference?: string; // python reference solution, used to compute expected output for custom inputs
}

function loadQuestion(dir: string): Question {
  const meta = QuestionMeta.parse(JSON.parse(fs.readFileSync(path.join(dir, "question.json"), "utf8")));
  const prompt = fs.readFileSync(path.join(dir, "prompt.md"), "utf8");
  const q: Question = { meta, dir, prompt, starter: {} };
  if (meta.type === "coding") {
    if (!meta.signature) throw new Error(`${meta.id}: coding questions need a signature`);
    for (const l of LANGUAGES) {
      const f = path.join(dir, "starter", `solution.${l.ext}`);
      if (fs.existsSync(f)) q.starter[l.id] = fs.readFileSync(f, "utf8");
    }
    q.tests = TestsFile.parse(JSON.parse(fs.readFileSync(path.join(dir, "tests.json"), "utf8"))) as Question["tests"];
    const ref = path.join(dir, "reference.py");
    if (fs.existsSync(ref)) q.reference = fs.readFileSync(ref, "utf8");
  }
  return q;
}

let cache: Map<string, Question> | null = null;

export function loadQuestions(force = false): Map<string, Question> {
  if (cache && !force) return cache;
  const map = new Map<string, Question>();
  for (const type of ["coding", "system-design"]) {
    const base = path.join(QUESTIONS_DIR, type);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base).sort()) {
      const dir = path.join(base, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const q = loadQuestion(dir);
      if (map.has(q.meta.id)) throw new Error(`Duplicate question id ${q.meta.id}`);
      map.set(q.meta.id, q);
    }
  }
  cache = map;
  return map;
}

export function getQuestion(id: string): Question {
  const q = loadQuestions().get(id);
  if (!q) throw Object.assign(new Error(`Unknown question ${id}`), { statusCode: 404 });
  return q;
}

export function summarize(q: Question): QuestionSummary {
  const { id, title, type, difficulty, tags, durationMinutes } = q.meta;
  return { id, title, type, difficulty, tags, durationMinutes };
}

/** What the candidate is allowed to see, given strictness and progress. */
export function questionView(q: Question, strictness: Strictness, submitted: boolean): QuestionView {
  return {
    ...summarize(q),
    prompt: q.prompt,
    starter: q.meta.type === "coding" ? q.starter : undefined,
    publicTests: strictness === "strict" ? undefined : q.tests?.public,
    signature: q.meta.signature ? { kind: q.meta.signature.kind, entry: q.meta.signature.entry } : undefined,
    followUps: submitted ? q.meta.followUps : undefined,
  };
}
