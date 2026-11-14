// Debugging questions: runs the question's checks (checks/run.mjs) against the candidate's project.
// Like the code runner, the Docker sandbox has no network, a read-only filesystem and an unprivileged
// user; the project is copied (without node_modules or its database) and mounted read-only.

import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CaseResult, RunResult } from "../../shared/types.ts";
import { ensureImage, runnerMode } from "../runner/execute.ts";
import { copyProject } from "./project.ts";

export const CHECKS_MARK = "@@DEFAANG_CHECKS@@";
export const CHECKS_IMAGE = "node:22-slim";
const TIMEOUT_MS = 90_000;

export type Suite = "public" | "all";

interface RawCheck {
  name: string;
  kind: "public" | "hidden";
  args?: unknown;
  expected?: unknown;
  output?: unknown;
  passed: boolean;
  error?: string;
}

/** Runs the checks of a debugging question (its folder `qdir`) against the project in `project`. */
export async function runChecks(qdir: string, project: string, suite: Suite): Promise<RunResult> {
  const started = Date.now();
  const unavailable = await ensureImage(CHECKS_IMAGE, "Node");
  if (unavailable) return { ok: false, compileError: unavailable, cases: [], passed: 0, total: 0, durationMs: 0 };

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "defaang-checks-"));
  fs.chmodSync(work, 0o755);
  const copy = path.join(work, "project");
  copyProject(project, copy);
  // The candidate's database stays out: the checks seed their own.
  fs.rmSync(path.join(copy, "data"), { recursive: true, force: true });
  if (fs.existsSync(path.join(project, "data"))) {
    fs.mkdirSync(path.join(copy, "data"));
    for (const f of fs.readdirSync(path.join(project, "data"))) if (f.endsWith(".json")) fs.copyFileSync(path.join(project, "data", f), path.join(copy, "data", f));
  }
  chmodTree(copy);
  const checks = path.join(qdir, "checks");

  let bin: string;
  let args: string[];
  const name = `defaang-checks-${randomUUID().slice(0, 12)}`;
  if (runnerMode() === "docker") {
    bin = "docker";
    args = [
      "run", "--rm", "-i", "--name", name,
      "--network", "none",
      "--memory", "512m", "--memory-swap", "512m", "--cpus", "1", "--pids-limit", "128",
      "--read-only", "--tmpfs", "/tmp:size=64m",
      "--user", "65534:65534", "--security-opt", "no-new-privileges",
      "-e", "HOME=/tmp",
      "-v", `${copy}:/project:ro`, "-v", `${checks}:/checks:ro`, "-w", "/tmp",
      CHECKS_IMAGE, "node", "--disable-warning=ExperimentalWarning", "/checks/run.mjs", "--project", "/project", "--suite", suite,
    ];
  } else {
    bin = process.execPath;
    args = ["--disable-warning=ExperimentalWarning", path.join(checks, "run.mjs"), "--project", copy, "--suite", suite];
  }

  try {
    const r = await new Promise<{ stdout: string; stderr: string; timedOut: boolean; code: number | null }>((resolve) => {
      const child = spawn(bin, args, { cwd: work, env: runnerMode() === "local" ? { PATH: process.env.PATH, HOME: work } : process.env });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        if (runnerMode() === "docker") execFile("docker", ["kill", name], () => {});
        child.kill("SIGKILL");
      }, TIMEOUT_MS);
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, timedOut, code });
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        resolve({ stdout, stderr: e.message, timedOut, code: null });
      });
      child.stdin.end();
    });
    const durationMs = Date.now() - started;
    const at = r.stdout.lastIndexOf(CHECKS_MARK);
    if (r.timedOut || at === -1) {
      const why = r.timedOut ? "The checks timed out." : "The checks didn't report results.";
      return { ok: false, compileError: `${why}\n${(r.stderr || r.stdout).slice(-4000)}`.trim(), cases: [], passed: 0, total: 0, durationMs };
    }
    const raw = JSON.parse(r.stdout.slice(at + CHECKS_MARK.length).split("\n")[0]) as RawCheck[];
    const cases: CaseResult[] = raw.map((c, index) => ({
      index,
      name: c.name,
      kind: c.kind,
      args: c.args ?? "",
      expected: c.expected,
      output: c.output,
      passed: c.passed && !c.error,
      error: c.error,
    }));
    return { ok: true, cases, passed: cases.filter((c) => c.passed).length, total: cases.length, durationMs, stderr: r.stderr.trim().slice(-4000) || undefined };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** Makes the copy readable by the sandbox's unprivileged user. */
function chmodTree(dir: string) {
  fs.chmodSync(dir, 0o755);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) chmodTree(p);
    else fs.chmodSync(p, 0o644);
  }
}
