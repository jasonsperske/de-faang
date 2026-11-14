import type { CaseResult, Language, RunResult, TestCase } from "../../shared/types.ts";
import type { Question } from "../questions.ts";
import { buildProgram, RESULT_MARKER, type HarnessSpec } from "./harness.ts";
import { ensureRuntime, execute, TIMEOUT_EXIT, type ExecResult } from "./execute.ts";
import { BEGIN_MARK, buildTypedProgram, END_MARK, isTypedLanguage } from "./typed.ts";
import { InputError } from "./signature.ts";

export interface LabeledCase {
  kind: CaseResult["kind"];
  test: TestCase;
}

interface RawCase {
  index: number;
  output?: unknown;
  error?: string;
  stdout?: string;
  ms?: number;
}

interface RawRun {
  ok: boolean;
  cases: RawCase[];
  compileError?: string;
  stderr?: string;
  durationMs: number;
}

const timeLimitMessage = () =>
  `Time limit exceeded (${process.env.DEFAANG_RUN_TIMEOUT ?? 10}s). Look for an infinite loop or an algorithm that is too slow.`;

async function runRaw(q: Question, lang: Language, code: string, tests: TestCase[]): Promise<RawRun> {
  const sig = q.meta.signature!;
  const entry = sig.entry[lang];
  if (!entry) return { ok: false, cases: [], compileError: `This question isn't available in ${lang} yet.`, durationMs: 0 };
  const unavailable = await ensureRuntime(lang);
  if (unavailable) return { ok: false, cases: [], compileError: unavailable, durationMs: 0 };
  if (isTypedLanguage(lang)) {
    let files: Record<string, string>;
    try {
      files = buildTypedProgram(lang, sig, entry, code, tests.map((t) => ({ args: t.args as unknown[], ops: t.ops })));
    } catch (e) {
      if (e instanceof InputError) return { ok: false, cases: [], compileError: `Invalid test input. ${e.message}`, durationMs: 0 };
      throw e;
    }
    return parseCaseStream(await execute(lang, files, ""), tests.length);
  }
  const spec = toSpec(q, lang, tests);
  const program = buildProgram(lang, code, entry);
  const r = await execute(lang, { [`main.${lang === "python" ? "py" : lang === "javascript" ? "js" : "ts"}`]: program }, JSON.stringify(spec));
  const idx = r.stdout.lastIndexOf(RESULT_MARKER);
  if (r.timedOut) {
    return {
      ok: false,
      cases: [],
      compileError: timeLimitMessage(),
      stderr: r.stderr.slice(-4000),
      durationMs: r.durationMs,
    };
  }
  if (idx === -1) {
    // The harness never reported: syntax error, import error, crash at module load, or OOM kill.
    const oom = r.exitCode === 137 ? "Process was killed (likely exceeded the 512MB memory limit).\n" : "";
    return {
      ok: false,
      cases: [],
      compileError: oom + (r.stderr.trim() || r.stdout.trim() || `Program exited with code ${r.exitCode}`).slice(-6000),
      durationMs: r.durationMs,
    };
  }
  const line = r.stdout.slice(idx + RESULT_MARKER.length).split("\n")[0];
  return { ok: true, cases: JSON.parse(line) as RawCase[], stderr: r.stderr.slice(-4000) || undefined, durationMs: r.durationMs };
}

const SIGNALS: Record<number, string> = {
  134: "Aborted (SIGABRT): e.g. a failed assertion, an uncaught C++ exception, a double free, or a Rust stack overflow.",
  136: "Floating point exception (SIGFPE): usually an integer division by zero.",
  137: "Killed (SIGKILL): the program exceeded the 512MB memory limit or the time limit.",
  139: "Segmentation fault (SIGSEGV): invalid memory access (null or dangling pointer, out-of-bounds index) or a stack overflow from deep recursion.",
};

/**
 * Parses the per-case stream the compiled-language harnesses print (see typed.ts). Cases that
 * finished keep their results even when a later case crashes or runs out of time.
 */
function parseCaseStream(r: ExecResult, count: number): RawRun {
  const stderr = r.stderr.slice(-4000) || undefined;
  const segments = r.stdout.split(BEGIN_MARK);
  if (segments.length === 1) {
    // Never reached the first case: compile error (or a crash before main).
    if (r.timedOut) return { ok: false, cases: [], compileError: "Compilation timed out.", stderr, durationMs: r.durationMs };
    if (r.exitCode === TIMEOUT_EXIT) return { ok: false, cases: [], compileError: timeLimitMessage(), stderr, durationMs: r.durationMs };
    const why = r.exitCode !== null && SIGNALS[r.exitCode] ? SIGNALS[r.exitCode] + "\n" : "";
    return {
      ok: false,
      cases: [],
      compileError: why + (r.stderr.trim() || r.stdout.trim() || `Program exited with code ${r.exitCode}`).slice(-6000),
      durationMs: r.durationMs,
    };
  }
  const crash = () => {
    if (r.timedOut || r.exitCode === TIMEOUT_EXIT) return timeLimitMessage() + " (shared across all test cases)";
    const sig = r.exitCode !== null ? SIGNALS[r.exitCode] : undefined;
    const tail = r.stderr.trim().slice(-1500);
    return [sig ?? `The program exited with code ${r.exitCode} during this case.`, tail].filter(Boolean).join("\n");
  };
  const cases: RawCase[] = [];
  for (let i = 0; i < count; i++) {
    const seg = segments[i + 1];
    if (seg === undefined) {
      cases.push({ index: i, error: "Not run: the program stopped during an earlier test case." });
      continue;
    }
    const end = seg.indexOf(END_MARK);
    if (end === -1) {
      cases.push({ index: i, error: crash(), stdout: seg.slice(-4000) || undefined });
      continue;
    }
    const stdout = seg.slice(0, end).slice(-4000);
    const line = seg.slice(end + END_MARK.length).split("\n")[0];
    try {
      const rec = JSON.parse(line) as { ms?: number; output?: unknown; error?: string };
      cases.push({ index: i, output: rec.error === undefined ? (rec.output ?? null) : undefined, error: rec.error, ms: rec.ms, stdout });
    } catch {
      cases.push({ index: i, error: crash(), stdout });
    }
  }
  return { ok: true, cases, stderr, durationMs: r.durationMs };
}

function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return a === b || Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return ka.length === kb.length && ka.every((k) => deepEqual((a as any)[k], (b as any)[k]));
}

export function matches(output: unknown, expected: unknown, mode: "exact" | "unordered"): boolean {
  if (mode === "unordered" && Array.isArray(output) && Array.isArray(expected)) {
    const sort = (arr: unknown[]) => [...arr].sort((x, y) => canonical(x).localeCompare(canonical(y)));
    return deepEqual(sort(output), sort(expected));
  }
  return deepEqual(output, expected);
}

function toSpec(q: Question, lang: Language, cases: TestCase[]): HarnessSpec {
  const sig = q.meta.signature!;
  return {
    kind: sig.kind,
    entry: sig.entry[lang]!,
    cases: cases.map((c) => ({ args: c.args as unknown[], ops: c.ops })),
  };
}

/**
 * Runs the candidate's code against the given cases. Custom cases (no expected value) get their
 * expected output from the question's Python reference solution when `withReference` is set.
 */
export async function runCases(
  q: Question,
  lang: Language,
  code: string,
  cases: LabeledCase[],
  opts: { withReference: boolean },
): Promise<RunResult> {
  const sig = q.meta.signature;
  if (!sig) throw new Error("Not a coding question");
  const tests = cases.map((c) => c.test);
  const needRef = opts.withReference && q.reference && cases.some((c) => c.test.expected === undefined);

  const [run, ref] = await Promise.all([
    runRaw(q, lang, code, tests),
    needRef ? runRaw(q, "python", q.reference!, tests) : Promise.resolve(null),
  ]);

  const results: CaseResult[] = cases.map((c, i) => {
    const raw = run.cases[i];
    let expected = c.test.expected;
    if (expected === undefined && ref?.ok && !ref.cases[i]?.error) expected = ref.cases[i]?.output;
    const res: CaseResult = {
      index: i,
      name: c.test.name,
      kind: c.kind,
      args: c.test.args,
      ops: c.test.ops,
      expected,
    };
    if (raw) {
      Object.assign(res, { output: raw.output, error: raw.error, stdout: raw.stdout || undefined, ms: raw.ms });
      if (expected !== undefined) res.passed = !raw.error && matches(raw.output, expected, sig.compare);
    } else if (expected !== undefined) {
      res.passed = false;
    }
    return res;
  });

  const graded = results.filter((r) => r.passed !== undefined);
  return {
    ok: run.ok,
    compileError: run.compileError,
    stderr: run.stderr,
    cases: results,
    passed: graded.filter((r) => r.passed).length,
    total: graded.length,
    durationMs: run.durationMs,
  };
}
