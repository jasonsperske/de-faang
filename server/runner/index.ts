import type { CaseResult, Language, RunResult, TestCase } from "../../shared/types.ts";
import type { Question } from "../questions.ts";
import { buildProgram, RESULT_MARKER, type HarnessSpec } from "./harness.ts";
import { execute } from "./execute.ts";

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

async function runRaw(lang: Language, code: string, entry: string, spec: HarnessSpec): Promise<RawRun> {
  const program = buildProgram(lang, code, entry);
  const r = await execute(lang, program, JSON.stringify(spec));
  const idx = r.stdout.lastIndexOf(RESULT_MARKER);
  if (r.timedOut) {
    return {
      ok: false,
      cases: [],
      compileError: `Time limit exceeded (${process.env.DEFAANG_RUN_TIMEOUT ?? 10}s). Look for an infinite loop or an algorithm that is too slow.`,
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
    entry: sig.entry[lang],
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
    runRaw(lang, code, sig.entry[lang], toSpec(q, lang, tests)),
    needRef ? runRaw("python", q.reference!, sig.entry.python, toSpec(q, "python", tests)) : Promise.resolve(null),
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
