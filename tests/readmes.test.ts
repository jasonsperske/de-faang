// The question READMEs, rubrics/README.md and the tables in README.md are generated from the
// question, rubric and resource data. This fails when someone edits that data without regenerating.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("generated READMEs", () => {
  it("are up to date (fix with `npm run readmes`)", () => {
    const r = spawnSync(process.execPath, ["scripts/generate-readmes.mjs", "--check"], { encoding: "utf8" });
    expect(r.stderr, r.stderr).toBe("");
    expect(r.status).toBe(0);
  });
});
