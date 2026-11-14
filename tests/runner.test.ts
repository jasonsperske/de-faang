import { describe, expect, it, beforeAll } from "vitest";
import { loadQuestions, getQuestion } from "../server/questions.ts";
import { runCases, matches } from "../server/runner/index.ts";
import type { Language } from "../shared/types.ts";

// Uses the local runner by default so tests are fast; set DEFAANG_TEST_RUNNER=docker to exercise the sandbox.
beforeAll(() => {
  process.env.DEFAANG_RUNNER = process.env.DEFAANG_TEST_RUNNER ?? "local";
  loadQuestions(true);
});

const twoSum: Record<Language, string> = {
  python: "def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n",
  javascript: "function twoSum(nums, target) {\n  const m = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    if (m.has(target - nums[i])) return [m.get(target - nums[i]), i];\n    m.set(nums[i], i);\n  }\n}\n",
  typescript: "function twoSum(nums: number[], target: number): number[] {\n  const m = new Map<number, number>();\n  for (let i = 0; i < nums.length; i++) {\n    const j = m.get(target - nums[i]);\n    if (j !== undefined) return [j, i];\n    m.set(nums[i], i);\n  }\n  return [];\n}\n",
};

const allCases = (id: string) => {
  const q = getQuestion(id);
  return [...q.tests!.public.map((t) => ({ kind: "public" as const, test: t })), ...q.tests!.hidden.map((t) => ({ kind: "hidden" as const, test: t }))];
};

describe("runner", () => {
  for (const lang of ["python", "javascript", "typescript"] as Language[]) {
    it(`passes two-sum in ${lang}`, async () => {
      const r = await runCases(getQuestion("two-sum"), lang, twoSum[lang], allCases("two-sum"), { withReference: false });
      expect(r.compileError).toBeUndefined();
      expect(r.passed).toBe(r.total);
      expect(r.total).toBe(8);
    });
  }

  it("runs class-style questions (LRU) in JS", async () => {
    const code = `class LRUCache {
  constructor(c) { this.c = c; this.m = new Map(); }
  get(k) { if (!this.m.has(k)) return -1; const v = this.m.get(k); this.m.delete(k); this.m.set(k, v); return v; }
  put(k, v) { this.m.delete(k); this.m.set(k, v); if (this.m.size > this.c) this.m.delete(this.m.keys().next().value); }
}`;
    const r = await runCases(getQuestion("lru-cache"), "javascript", code, allCases("lru-cache"), { withReference: false });
    expect(r.passed).toBe(r.total);
  });

  it("reports syntax errors as compile errors", async () => {
    const r = await runCases(getQuestion("two-sum"), "python", "def two_sum(nums, target)\n  return []", allCases("two-sum"), { withReference: false });
    expect(r.ok).toBe(false);
    expect(r.compileError).toMatch(/SyntaxError/);
  });

  it("captures per-case runtime errors and stdout", async () => {
    const code = "def two_sum(nums, target):\n    print('debug', len(nums))\n    return nums[100]\n";
    const r = await runCases(getQuestion("two-sum"), "python", code, allCases("two-sum").slice(0, 1), { withReference: false });
    expect(r.cases[0].error).toMatch(/IndexError/);
    expect(r.cases[0].stdout).toContain("debug 4");
    expect(r.cases[0].passed).toBe(false);
  });

  it("computes expected output for custom cases from the reference solution", async () => {
    const r = await runCases(getQuestion("merge-intervals"), "python", "def merge(intervals):\n    return intervals\n", [{ kind: "custom", test: { args: [[[1, 5], [2, 3]]] } }], { withReference: true });
    expect(r.cases[0].expected).toEqual([[1, 5]]);
    expect(r.cases[0].passed).toBe(false);
  });

  it("enforces the time limit", async () => {
    process.env.DEFAANG_RUN_TIMEOUT = "2";
    const r = await runCases(getQuestion("two-sum"), "javascript", "function twoSum() { while (true) {} }", allCases("two-sum"), { withReference: false });
    delete process.env.DEFAANG_RUN_TIMEOUT;
    expect(r.ok).toBe(false);
    expect(r.compileError).toMatch(/Time limit/);
  });

  it("compares unordered results", () => {
    expect(matches([1, 0], [0, 1], "unordered")).toBe(true);
    expect(matches([1, 0], [0, 1], "exact")).toBe(false);
    expect(matches(0.1 + 0.2, 0.3, "exact")).toBe(true);
  });
});
