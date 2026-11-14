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
    if (!q.reference) problems.push("missing reference.py");
    else {
      const cases = [...q.tests!.public.map((t) => ({ kind: "public" as const, test: t })), ...q.tests!.hidden.map((t) => ({ kind: "hidden" as const, test: t }))];
      const r = await runCases(q, "python", q.reference, cases, { withReference: false });
      if (!r.ok) problems.push(`reference failed to run: ${r.compileError}`);
      for (const c of r.cases) if (!c.passed) problems.push(`reference fails ${c.kind} case "${c.name ?? c.index}": got ${JSON.stringify(c.output)} ${c.error ?? ""}`);
    }
  }
  failed ||= problems.length > 0;
  console.log(`${problems.length ? "✗" : "✓"} ${q.meta.id}${problems.map((p) => `\n    - ${p}`).join("")}`);
}
console.log(`\n${qs.size} questions checked.`);
process.exit(failed ? 1 : 0);
