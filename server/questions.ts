import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Language, ProjectFile, QuestionSummary, QuestionView, Strictness, TestCase } from "../shared/types.ts";
import { LANGUAGES } from "../shared/types.ts";
import { ROOT } from "./paths.ts";
import { isTyped, parseType, snake } from "./runner/signature.ts";
import { addPartStub, generateStarter } from "./runner/starters.ts";
import { defaultEntry, supportsLanguage, TYPED_LANGUAGES } from "./runner/typed.ts";

export const QUESTIONS_DIR = path.join(ROOT, "questions");

const LangRecord = z.object({
  // JavaScript names the entry point; Python defaults to its snake_case form (for functions) and
  // TypeScript to the JavaScript name.
  python: z.string().optional(),
  javascript: z.string(),
  typescript: z.string().optional(),
  // Optional overrides; by default derived from the JavaScript (or, for Rust, Python) name. C# uses
  // the JavaScript name in PascalCase for functions and as-is for classes.
  go: z.string().optional(),
  c: z.string().optional(),
  cpp: z.string().optional(),
  rust: z.string().optional(),
  java: z.string().optional(),
  csharp: z.string().optional(),
});

const TypeStr = z.string().refine((t) => {
  try {
    parseType(t);
    return true;
  } catch {
    return false;
  }
}, "Unknown type. Use int, long, double, bool, string (with [] for arrays) or void.");
const Param = z.object({ name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), type: TypeStr });

const SignatureSchema = z.object({
  kind: z.enum(["function", "class"]),
  entry: LangRecord,
  /** exact: deep equality. unordered: top-level array order is ignored. */
  compare: z.enum(["exact", "unordered"]).default("exact"),
  /**
   * Types, needed for Go, C, C++, Rust, Java and C# (see server/runner/signature.ts).
   * function kind: params + returns. class kind: init (constructor params) + methods by op name.
   */
  params: z.array(Param).optional(),
  returns: TypeStr.optional(),
  init: z.array(Param).optional(),
  methods: z.record(z.string(), z.object({ params: z.array(Param).default([]), returns: TypeStr.default("void") })).optional(),
});
type SignatureMeta = z.infer<typeof SignatureSchema>;
/** A signature with an entry-point name for every language the question supports. */
export type Signature = Omit<SignatureMeta, "entry"> & { entry: Partial<Record<Language, string>> };

const PartNotes = z.object({ approach: z.string(), hints: z.array(z.string()), pitfalls: z.array(z.string()).default([]) });

const PartMeta = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  /** Suggested time for this part; the interviewer uses it for pacing. */
  durationMinutes: z.number().int().positive().optional(),
  signature: SignatureSchema.refine(isTyped, "Multipart questions need typed signatures (params/returns or init/methods)."),
  /** Private interviewer notes for this part. */
  interviewer: PartNotes,
});

/** A rubric dimension (same shape as in rubrics/*.json). */
export const RubricDimension = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string(),
  weight: z.number().positive(),
  signals: z.string(),
  levels: z.object({ "1": z.string(), "2": z.string(), "3": z.string(), "4": z.string() }),
  resources: z.array(z.string()).default([]),
});

/** How AI-assisted rounds of this question are graded and watched. */
const AiSection = z.object({
  /** Rubric used for AI-assisted rounds (rubrics/<id>.json). */
  rubric: z.string().default("ai-coding"),
  /** Question-specific rubric dimensions added to that rubric. Weights are relative to the rubric's (which sum to 1). */
  dimensions: z.array(RubricDimension).default([]),
  /** Known ways AI assistants go wrong on this question; the interviewer and evaluator check whether the candidate caught them. */
  watchFor: z.array(z.string()).default([]),
});

const QuestionMeta = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    type: z.enum(["coding", "debugging", "system-design"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    durationMinutes: z.number().int().positive(),
    tags: z.array(z.string()),
    rubric: z.string(),
    signature: SignatureSchema.optional(),
    /**
     * Multipart coding questions: the parts in order. Each has its own signature, tests
     * (parts/<id>/tests.json), prompt (parts/<id>/prompt.md) and interviewer notes. Later parts are
     * revealed only after the candidate hands in the current one.
     */
    parts: z.array(PartMeta).min(2).optional(),
    followUps: z.array(z.string()).min(1),
    /** Private notes for the interviewer LLM. Never sent to the browser. For multipart questions these cover the whole round. */
    interviewer: z.object({
      approach: z.string().default(""),
      hints: z.array(z.string()).default([]),
      pitfalls: z.array(z.string()).default([]),
      /** For system design: facts the interviewer reveals only when asked (scale, constraints). */
      facts: z.array(z.string()).default([]),
      deepDives: z.array(z.string()).default([]),
    }),
    resources: z.array(z.string()).default([]),
    /**
     * Debugging questions: how to run the project in project/. `command` starts its dev server (with
     * hot reloading) from the project root; the editor opens `open` first.
     */
    app: z.object({ command: z.array(z.string()).min(1).default(["npm", "run", "dev"]), open: z.string().optional() }).optional(),
    /** Coding and debugging questions: settings for AI-assisted rounds. */
    ai: AiSection.default({ rubric: "ai-coding", dimensions: [], watchFor: [] }),
  })
  .refine((m) => m.type !== "coding" || Boolean(m.signature) !== Boolean(m.parts), "A coding question needs either a signature or parts (not both).")
  .refine((m) => !m.parts || new Set(m.parts.map((p) => p.id)).size === m.parts.length, "Part ids must be unique.")
  .refine((m) => m.type !== "debugging" || (!m.signature && !m.parts), "A debugging question has a project/ folder and checks, not a signature or parts.");
export type QuestionMeta = z.infer<typeof QuestionMeta>;

const TestCaseSchema = z.object({
  name: z.string().optional(),
  args: z.array(z.unknown()),
  ops: z.array(z.string()).optional(),
  expected: z.unknown(),
});
const TestsFile = z.object({ public: z.array(TestCaseSchema), hidden: z.array(TestCaseSchema) });

export interface Part {
  index: number;
  id: string;
  title: string;
  durationMinutes?: number;
  /** For single-part questions this is the whole prompt. */
  prompt: string;
  signature: Signature;
  tests: { public: TestCase[]; hidden: TestCase[] };
  interviewer: { approach: string; hints: string[]; pitfalls: string[] };
}

export interface Question {
  meta: QuestionMeta;
  /** Languages this question can be solved in. */
  languages: Language[];
  dir: string;
  /** The prompt (single-part) or the shared introduction (multipart). */
  prompt: string;
  /** Starter code for the first part. */
  starter: Partial<Record<Language, string>>;
  /** Coding questions: one entry, or one per part for multipart questions. */
  parts: Part[];
  multipart: boolean;
  /** Tests of the first part (all tests for a single-part question). */
  tests?: { public: TestCase[]; hidden: TestCase[] };
  reference?: string; // python reference solution, used to compute expected output for custom inputs
  /** Debugging questions: the project the candidate debugs (a copy goes into each session). */
  project?: { dir: string; command: string[]; open?: string };
}

/** Fills in entry-point names for every language the signature can support. */
function withEntries(sig: SignatureMeta): Signature {
  const js = sig.entry.javascript;
  const entry: Partial<Record<Language, string>> = {
    ...sig.entry,
    python: sig.entry.python ?? (sig.kind === "function" ? snake(js) : js),
    typescript: sig.entry.typescript ?? js,
  };
  if (isTyped(sig)) {
    for (const l of TYPED_LANGUAGES)
      if (supportsLanguage(l, sig)) entry[l] ??= defaultEntry(l, sig.kind, { python: entry.python!, javascript: js });
  }
  return { ...sig, entry };
}

const readTests = (file: string) => TestsFile.parse(JSON.parse(fs.readFileSync(file, "utf8"))) as Part["tests"];

function loadQuestion(dir: string): Question {
  const meta = QuestionMeta.parse(JSON.parse(fs.readFileSync(path.join(dir, "question.json"), "utf8")));
  const prompt = fs.readFileSync(path.join(dir, "prompt.md"), "utf8");
  const q: Question = { meta, dir, prompt, starter: {}, languages: [], parts: [], multipart: Boolean(meta.parts) };
  if (meta.type === "debugging") {
    for (const need of ["project", path.join("checks", "run.mjs")])
      if (!fs.existsSync(path.join(dir, need))) throw new Error(`Debugging question ${meta.id} is missing ${need}`);
    q.project = { dir: path.join(dir, "project"), command: meta.app?.command ?? ["npm", "run", "dev"], open: meta.app?.open };
    return q;
  }
  if (meta.type !== "coding") return q;

  if (meta.parts) {
    q.parts = meta.parts.map((p, index) => {
      const pdir = path.join(dir, "parts", p.id);
      return {
        index,
        id: p.id,
        title: p.title,
        durationMinutes: p.durationMinutes,
        prompt: fs.readFileSync(path.join(pdir, "prompt.md"), "utf8"),
        signature: withEntries(p.signature),
        tests: readTests(path.join(pdir, "tests.json")),
        interviewer: p.interviewer,
      };
    });
  } else {
    const sig = withEntries(meta.signature!);
    q.parts = [
      {
        index: 0,
        id: meta.id,
        title: meta.title,
        prompt,
        signature: sig,
        tests: readTests(path.join(dir, "tests.json")),
        interviewer: { approach: meta.interviewer.approach, hints: meta.interviewer.hints, pitfalls: meta.interviewer.pitfalls },
      },
    ];
  }
  // A language is offered only when every part supports it.
  q.languages = LANGUAGES.map((l) => l.id).filter((l) => q.parts.every((p) => p.signature.entry[l]));
  q.tests = q.parts[0].tests;
  const sig = q.parts[0].signature;
  for (const l of q.languages) {
    const f = path.join(dir, "starter", `solution.${LANGUAGES.find((x) => x.id === l)!.ext}`);
    if (!q.multipart && fs.existsSync(f)) q.starter[l] = fs.readFileSync(f, "utf8");
    else if (isTyped(sig)) q.starter[l] = generateStarter(l, sig, sig.entry[l]!);
  }
  q.languages = q.languages.filter((l) => q.starter[l] !== undefined);
  const ref = path.join(dir, "reference.py");
  if (fs.existsSync(ref)) q.reference = fs.readFileSync(ref, "utf8");
  return q;
}

/** Starter code with the stubs for parts 0..upTo, as the candidate sees it on reaching part `upTo`. */
export function starterThrough(q: Question, upTo: number): Partial<Record<Language, string>> {
  const out: Partial<Record<Language, string>> = {};
  for (const l of q.languages) {
    let code = q.starter[l]!;
    for (const p of q.parts.slice(1, upTo + 1)) code = addPartStub(l, code, p.signature, p.signature.entry[l]!);
    out[l] = code;
  }
  return out;
}

let cache: Map<string, Question> | null = null;

export function loadQuestions(force = false): Map<string, Question> {
  if (cache && !force) return cache;
  const map = new Map<string, Question>();
  for (const type of ["coding", "debugging", "system-design"]) {
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
  return {
    id,
    title,
    type,
    difficulty,
    tags,
    durationMinutes,
    languages: q.meta.type === "coding" ? q.languages : undefined,
    parts: q.multipart ? q.parts.length : undefined,
  };
}

/** What the candidate is allowed to see, given strictness and progress. `files` lists the session's project (debugging questions). */
export function questionView(q: Question, strictness: Strictness, submitted: boolean, part = 0, files?: ProjectFile[]): QuestionView {
  const coding = q.meta.type === "coding";
  const current = coding ? q.parts[Math.min(part, q.parts.length - 1)] : undefined;
  return {
    ...summarize(q),
    prompt: q.prompt,
    partViews: q.multipart ? q.parts.slice(0, part + 1).map((p) => ({ index: p.index, id: p.id, title: p.title, prompt: p.prompt })) : undefined,
    part: q.multipart ? part : undefined,
    starter: coding ? starterThrough(q, part) : undefined,
    publicTests: strictness === "strict" ? undefined : current?.tests.public,
    signature: current ? { kind: current.signature.kind, entry: current.signature.entry } : undefined,
    followUps: submitted ? q.meta.followUps : undefined,
    project: q.project ? { files: files ?? [], open: q.project.open, checks: strictness !== "strict" } : undefined,
  };
}
