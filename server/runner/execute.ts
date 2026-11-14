import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { Language } from "../../shared/types.ts";

const execFileP = promisify(execFile);

interface LangRuntime {
  image: string;
  file: string;
  cmd: (file: string) => string[];
}

export const RUNTIMES: Record<Language, LangRuntime> = {
  python: { image: "python:3.12-slim", file: "main.py", cmd: (f) => ["python3", "-u", f] },
  javascript: { image: "node:22-slim", file: "main.js", cmd: (f) => ["node", f] },
  typescript: {
    image: "node:22-slim",
    file: "main.ts",
    cmd: (f) => ["node", "--experimental-strip-types", "--no-warnings", f],
  },
};

export type RunnerMode = "docker" | "local";
export const runnerMode = (): RunnerMode => (process.env.DEFAANG_RUNNER === "local" ? "local" : "docker");
const timeoutSec = () => Number(process.env.DEFAANG_RUN_TIMEOUT ?? 10);
const MAX_OUTPUT = 2 * 1024 * 1024;

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export async function execute(lang: Language, source: string, stdin: string): Promise<ExecResult> {
  const rt = RUNTIMES[lang];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "defaang-run-"));
  fs.chmodSync(dir, 0o755); // the container runs as an unprivileged user
  fs.writeFileSync(path.join(dir, rt.file), source, { mode: 0o644 });
  const name = `defaang-${randomUUID().slice(0, 12)}`;
  const limit = timeoutSec();

  let bin: string;
  let args: string[];
  if (runnerMode() === "docker") {
    bin = "docker";
    args = [
      "run", "--rm", "-i", "--name", name,
      "--network", "none",
      "--memory", "512m", "--memory-swap", "512m",
      "--cpus", "1", "--pids-limit", "64",
      "--read-only", "--tmpfs", "/tmp:size=16m",
      "--user", "65534:65534",
      "--security-opt", "no-new-privileges",
      "-e", "PYTHONDONTWRITEBYTECODE=1",
      "-v", `${dir}:/work:ro`, "-w", "/work",
      rt.image, ...rt.cmd(`/work/${rt.file}`),
    ];
  } else {
    const [cmd, ...rest] = rt.cmd(path.join(dir, rt.file));
    bin = cmd;
    args = rest;
  }

  const started = Date.now();
  try {
    return await new Promise<ExecResult>((resolve, reject) => {
      const child = spawn(bin, args, {
        cwd: dir,
        env: runnerMode() === "local" ? { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: "1", HOME: dir } : process.env,
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      // Docker adds container start-up time, so give it headroom beyond the program limit.
      const wall = (limit + (runnerMode() === "docker" ? 5 : 0)) * 1000;
      const timer = setTimeout(() => {
        timedOut = true;
        if (runnerMode() === "docker") execFile("docker", ["kill", name], () => {});
        child.kill("SIGKILL");
      }, wall);
      child.stdout.on("data", (d) => {
        if (stdout.length < MAX_OUTPUT) stdout += d;
      });
      child.stderr.on("data", (d) => {
        if (stderr.length < MAX_OUTPUT) stderr += d;
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code, timedOut, durationMs: Date.now() - started });
      });
      child.stdin.on("error", () => {}); // program may exit before reading stdin
      child.stdin.end(stdin);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Checks the runner can work; pulls missing images in the background. */
export async function checkRunner(): Promise<{ ready: boolean; message?: string }> {
  if (runnerMode() === "local") return { ready: true, message: "Local runner: code runs on this machine without isolation." };
  try {
    await execFileP("docker", ["info", "--format", "{{.ServerVersion}}"]);
  } catch {
    return { ready: false, message: "Docker is not reachable. Start Docker or set DEFAANG_RUNNER=local in .env." };
  }
  const images = [...new Set(Object.values(RUNTIMES).map((r) => r.image))];
  const missing: string[] = [];
  for (const img of images) {
    try {
      await execFileP("docker", ["image", "inspect", img]);
    } catch {
      missing.push(img);
    }
  }
  if (missing.length) {
    for (const img of missing) if (!pulling.has(img)) pull(img);
    return { ready: false, message: `Pulling runtime images: ${missing.join(", ")} (first run only)…` };
  }
  return { ready: true };
}

const pulling = new Set<string>();
function pull(img: string) {
  pulling.add(img);
  console.log(`[runner] docker pull ${img}`);
  execFile("docker", ["pull", img], (err) => {
    pulling.delete(img);
    console.log(err ? `[runner] failed to pull ${img}: ${err.message}` : `[runner] pulled ${img}`);
  });
}
