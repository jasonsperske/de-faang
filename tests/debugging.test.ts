// Debugging questions: the project copy and diff, path safety, the checks, and the running app
// (dev server, hot reload, terminal). Uses the local runner by default; DEFAANG_TEST_RUNNER=docker
// runs the app and the checks in Docker (needs `npm run docker:pull` for defaang-node-dev:1).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getQuestion, loadQuestions } from "../server/questions.ts";
import { copyProject, listFiles, projectChanges, projectDir, resolveInProject, unifiedDiff } from "../server/debug/project.ts";
import { runChecks } from "../server/debug/checks.ts";
import { appStatus, runCommand, startApp, stopApp } from "../server/debug/app.ts";
import { createSession } from "../server/sessions.ts";
import { SESSIONS_DIR } from "../server/paths.ts";

const ID = "account-revenue-table";

beforeAll(() => {
  process.env.DEFAANG_RUNNER = process.env.DEFAANG_TEST_RUNNER ?? "local";
  loadQuestions(true);
});

const tmpDirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "defaang-test-"));
  tmpDirs.push(d);
  return d;
};
afterAll(() => tmpDirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe("project files", () => {
  it("diffs only the lines that changed", () => {
    const { diff, added } = unifiedDiff("a\nb\nc\nd\ne\nf\ng\nh\n", "a\nb\nc\nD\ne\nf\ng\nh\n", "a/x.js", "b/x.js");
    expect(diff).toBe("--- a/x.js\n+++ b/x.js\n@@ -1,7 +1,7 @@\n a\n b\n c\n-d\n+D\n e\n f\n g\n");
    expect(added).toEqual(["D"]);
  });

  it("reports added, deleted and modified files, ignoring node_modules", () => {
    const q = getQuestion(ID);
    const copy = tmp();
    copyProject(q.project!.dir, copy);
    fs.appendFileSync(path.join(copy, "server", "accounts.js"), "// fixed\n");
    fs.rmSync(path.join(copy, "README.md"));
    fs.writeFileSync(path.join(copy, "server", "new.js"), "export {};\n");
    fs.mkdirSync(path.join(copy, "node_modules", "x"), { recursive: true });
    fs.writeFileSync(path.join(copy, "node_modules", "x", "index.js"), "junk\n");
    const changes = projectChanges(q.project!.dir, copy);
    expect(changes.map((c) => [c.path, c.status])).toEqual([
      ["README.md", "deleted"],
      ["server/accounts.js", "modified"],
      ["server/new.js", "added"],
    ]);
    expect(listFiles(copy).some((f) => f.path.startsWith("node_modules"))).toBe(false);
  });

  it("refuses paths outside the project", () => {
    const root = tmp();
    for (const bad of ["../x", "a/../../x", "node_modules/react/index.js", "", "a//b"]) expect(() => resolveInProject(root, bad), bad).toThrow();
    expect(resolveInProject(root, "src/App.jsx")).toBe(path.join(root, "src", "App.jsx"));
  });
});

describe("checks", () => {
  it("fail on the buggy project", async () => {
    const q = getQuestion(ID);
    const r = await runChecks(q.dir, q.project!.dir, "all");
    expect(r.compileError).toBeUndefined();
    expect(r.cases.filter((c) => c.kind === "public").every((c) => !c.passed)).toBe(true);
    expect(r.cases.some((c) => c.kind === "hidden")).toBe(true);
  });

  it("pass with the reference fix, and the public suite has no hidden checks", async () => {
    const q = getQuestion(ID);
    const fixed = tmp();
    copyProject(q.project!.dir, fixed);
    fs.cpSync(path.join(q.dir, "solution"), fixed, { recursive: true });
    const all = await runChecks(q.dir, fixed, "all");
    expect(all.passed).toBe(all.total);
    expect(all.total).toBeGreaterThan(8);
    const pub = await runChecks(q.dir, fixed, "public");
    expect(pub.cases.every((c) => c.kind === "public")).toBe(true);
    expect(pub.passed).toBe(pub.total);
  });

  it("catch a SUM(DISTINCT ...) fix that only works on the sample data", async () => {
    const q = getQuestion(ID);
    const copy = tmp();
    copyProject(q.project!.dir, copy);
    const file = path.join(copy, "server", "accounts.js");
    const src = fs.readFileSync(file, "utf8")
      .replace("COUNT(o.id) ", "COUNT(DISTINCT o.id) ")
      .replace("SUM(o.amount_cents) / 100                      AS gross", "COALESCE(SUM(DISTINCT o.amount_cents), 0) / 100.0 AS gross")
      .replace("SUM(r.amount_cents) / 100                      AS refunded", "COALESCE(SUM(DISTINCT r.amount_cents), 0) / 100.0 AS refunded")
      .replace("(SUM(o.amount_cents) - SUM(r.amount_cents)) / 100 AS net", "(COALESCE(SUM(DISTINCT o.amount_cents), 0) - COALESCE(SUM(DISTINCT r.amount_cents), 0)) / 100.0 AS net");
    expect(src).toContain("SUM(DISTINCT o.amount_cents)");
    fs.writeFileSync(file, src);
    const r = await runChecks(q.dir, copy, "all");
    expect(r.cases.find((c) => c.name === "Orders with identical amounts all count")?.passed).toBe(false);
  });
});

describe("the running app", () => {
  let sessionId = "";
  beforeAll(() => {
    sessionId = createSession(ID, { provider: "claude", strictness: "standard", verbosity: "normal" }).id;
  });
  afterAll(async () => {
    await stopApp(sessionId);
    fs.rmSync(path.join(SESSIONS_DIR, sessionId), { recursive: true, force: true });
  });

  const waitFor = async <T>(fn: () => Promise<T | undefined>, ms: number): Promise<T> => {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn().catch(() => undefined);
      if (v !== undefined) return v;
      if (Date.now() > end) throw new Error("timed out");
      await new Promise((r) => setTimeout(r, 300));
    }
  };
  const acme = async (url: string) => {
    const res = await fetch(new URL("/api/accounts", url));
    if (!res.ok) return undefined;
    return ((await res.json()) as { accounts: { name: string; orders: number }[] }).accounts.find((a) => a.name === "Acme Corp");
  };

  it("starts the dev server, serves the API through it, and reloads the API on edit", async () => {
    const q = getQuestion(ID);
    await startApp(sessionId, { command: q.project!.command });
    const status = await waitFor(async () => {
      const s = appStatus(sessionId);
      if (s.state === "failed") throw new Error(`${s.message}\n${s.logs}`);
      return s.state === "running" ? s : undefined;
    }, 120_000);
    expect((await waitFor(() => acme(status.url!), 15_000)).orders).toBe(6);

    fs.copyFileSync(path.join(q.dir, "solution", "server", "accounts.js"), path.join(projectDir(sessionId), "server", "accounts.js"));
    const fixed = await waitFor(async () => {
      const a = await acme(status.url!);
      return a?.orders === 3 ? a : undefined;
    }, 20_000);
    expect(fixed.orders).toBe(3);
  }, 180_000);

  it("runs terminal commands from the project root", async () => {
    const q = getQuestion(ID);
    let out = "";
    const r = await runCommand(sessionId, { command: q.project!.command }, `npm run -s db:query "SELECT COUNT(*) AS n FROM orders WHERE customer_id = 1 AND status = 'paid'"`, (s) => (out += s), new AbortController().signal);
    expect(r.exitCode).toBe(0);
    expect(out).toMatch(/│\s*3\s*│/);
  }, 60_000);

  it("stops a command when asked", async () => {
    const q = getQuestion(ID);
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1000);
    const started = Date.now();
    const r = await runCommand(sessionId, { command: q.project!.command }, "sleep 30", () => {}, ctrl.signal);
    expect(r.exitCode).not.toBe(0);
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 30_000);
});
