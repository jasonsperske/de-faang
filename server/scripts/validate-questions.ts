// Validates every question: schema, resource ids, and that reference.py passes all of its own tests.
// Usage: npm run validate
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadQuestions, type Question } from "../questions.ts";
import os from "node:os";
import { runCases } from "../runner/index.ts";
import { runChecks } from "../debug/checks.ts";
import { copyProject } from "../debug/project.ts";
import { ROOT } from "../paths.ts";

const resources = new Set((JSON.parse(fs.readFileSync(path.join(ROOT, "resources/resources.json"), "utf8")) as { id: string }[]).map((r) => r.id));
let failed = false;
const qs = loadQuestions(true);
for (const q of qs.values()) {
  const problems: string[] = [];
  for (const r of q.meta.resources) if (!resources.has(r)) problems.push(`unknown resource id "${r}"`);
  if (!fs.existsSync(path.join(ROOT, "rubrics", `${q.meta.rubric}.json`))) problems.push(`unknown rubric "${q.meta.rubric}"`);
  if (q.meta.type === "coding" || q.meta.type === "debugging") {
    const aiRubric = path.join(ROOT, "rubrics", `${q.meta.ai.rubric}.json`);
    if (!fs.existsSync(aiRubric)) problems.push(`unknown AI rubric "${q.meta.ai.rubric}"`);
    else {
      const baseIds = new Set((JSON.parse(fs.readFileSync(aiRubric, "utf8")) as { dimensions: { id: string }[] }).dimensions.map((d) => d.id));
      for (const d of q.meta.ai.dimensions) {
        if (baseIds.has(d.id)) problems.push(`AI dimension "${d.id}" clashes with a dimension of rubric "${q.meta.ai.rubric}"`);
        for (const r of d.resources) if (!resources.has(r)) problems.push(`AI dimension "${d.id}": unknown resource id "${r}"`);
      }
    }
  }
  if (q.meta.type === "debugging") problems.push(...(await validateDebugging(q)));
  if (q.meta.type === "coding") {
    if (!q.reference) problems.push("missing reference.py");
    else {
      for (const p of q.parts) {
        const where = q.multipart ? `part ${p.index + 1} (${p.id}) ` : "";
        const cases = [...p.tests.public.map((t) => ({ kind: "public" as const, test: t })), ...p.tests.hidden.map((t) => ({ kind: "hidden" as const, test: t }))];
        if (!p.tests.public.length) problems.push(`${where}has no public tests`);
        const r = await runCases(q, "python", q.reference, cases, { withReference: false, part: p.index });
        if (!r.ok) problems.push(`${where}reference failed to run: ${r.compileError}`);
        for (const c of r.cases) if (!c.passed) problems.push(`${where}reference fails ${c.kind} case "${c.name ?? c.index}": got ${JSON.stringify(c.output)} ${c.error ?? ""}`);
      }
    }
    for (const l of ["python", "javascript", "typescript"] as const) if (!q.languages.includes(l)) problems.push(`not available in ${l} (add a starter file or a typed signature)`);
  }
  failed ||= problems.length > 0;
  const parts = q.multipart ? ` (${q.parts.length} parts)` : "";
  console.log(`${problems.length ? "✗" : "✓"} ${q.meta.id}${parts}${problems.map((p) => `\n    - ${p}`).join("")}`);
}
console.log(`\n${qs.size} questions checked.`);
process.exit(failed ? 1 : 0);

/**
 * A debugging question must ship a real bug and a real fix: its checks fail on project/ as given,
 * and pass on project/ with solution/ copied over it.
 */
async function validateDebugging(q: Question): Promise<string[]> {
  const problems: string[] = [];
  const solution = path.join(q.dir, "solution");
  if (!fs.existsSync(solution)) return ["missing solution/ (the fixed files, laid out like project/)"];
  if (q.project?.open && !fs.existsSync(path.join(q.project.dir, q.project.open))) problems.push(`app.open: no file project/${q.project.open}`);
  const buggy = await runChecks(q.dir, q.project!.dir, "all");
  if (!buggy.ok) problems.push(`checks failed to run on the buggy project: ${buggy.compileError}`);
  else {
    if (!buggy.cases.some((c) => c.kind === "public")) problems.push("checks have no public (sample) checks");
    if (!buggy.cases.some((c) => c.kind === "public" && !c.passed)) problems.push("no public check fails on the buggy project, so the bug isn't reproduced");
  }
  const fixed = fs.mkdtempSync(path.join(os.tmpdir(), "defaang-validate-"));
  try {
    copyProject(q.project!.dir, fixed);
    fs.cpSync(solution, fixed, { recursive: true });
    const r = await runChecks(q.dir, fixed, "all");
    if (!r.ok) problems.push(`checks failed to run on the fixed project: ${r.compileError}`);
    for (const c of r.cases) if (!c.passed) problems.push(`solution fails ${c.kind} check "${c.name}": got ${JSON.stringify(c.output)} ${c.error ?? ""}`);
  } finally {
    fs.rmSync(fixed, { recursive: true, force: true });
  }
  return problems;
}
process.exit(failed ? 1 : 0);
