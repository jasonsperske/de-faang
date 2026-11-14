// Validates every question: schema, resource ids, and that reference.py passes all of its own tests.
// Usage: npm run validate
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadQuestions } from "../questions.ts";
import { runCases } from "../runner/index.ts";
import { ROOT } from "../paths.ts";

const resources = new Set((JSON.parse(fs.readFileSync(path.join(ROOT, "resources/resources.json"), "utf8")) as { id: string }[]).map((r) => r.id));
let failed = false;
const qs = loadQuestions(true);
for (const q of qs.values()) {
  const problems: string[] = [];
  for (const r of q.meta.resources) if (!resources.has(r)) problems.push(`unknown resource id "${r}"`);
  if (!fs.existsSync(path.join(ROOT, "rubrics", `${q.meta.rubric}.json`))) problems.push(`unknown rubric "${q.meta.rubric}"`);
  if (q.meta.type === "coding") {
    const aiRubric = path.join(ROOT, "rubrics", `${q.meta.ai.rubric}.json`);
    if (!fs.existsSync(aiRubric)) problems.push(`unknown AI rubric "${q.meta.ai.rubric}"`);
    else {
      const baseIds = new Set((JSON.parse(fs.readFileSync(aiRubric, "utf8")) as { dimensions: { id: string }[] }).dimensions.map((d) => d.id));
      for (const d of q.meta.ai.dimensions) {
        if (baseIds.has(d.id)) problems.push(`AI dimension "${d.id}" clashes with a dimension of rubric "${q.meta.ai.rubric}"`);
        for (const r of d.resources) if (!resources.has(r)) problems.push(`AI dimension "${d.id}": unknown resource id "${r}"`);
      }
    }
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
