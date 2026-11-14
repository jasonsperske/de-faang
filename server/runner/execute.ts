import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { Language } from "../../shared/types.ts";
import { ROOT } from "../paths.ts";

const execFileP = promisify(execFile);

interface LangRuntime {
  image: string;
  /** Interpreted languages: argv to run the program (`src` = directory holding the source files). */
  run?: (src: string) => string[];
  /**
   * Compiled languages: a shell script that compiles into `out` (writable scratch) and then runs the
   * binary under `timeout`, so compile time doesn't count against the time limit.
   */
  build?: (src: string, out: string) => { compile: string; exec: string };
  /** Extra wall-clock seconds allowed for compilation. */
  compileSeconds?: number;
  /** Size of the writable /tmp inside the container. */
  tmpfs?: string;
}

const sh = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

export const RUNTIMES: Record<Language, LangRuntime> = {
  python: { image: "python:3.12-slim", run: (d) => ["python3", "-u", `${d}/main.py`] },
  javascript: { image: "node:22-slim", run: (d) => ["node", `${d}/main.js`] },
  typescript: { image: "node:22-slim", run: (d) => ["node", "--experimental-strip-types", "--no-warnings", `${d}/main.ts`] },
  c: {
    image: "gcc:15",
    compileSeconds: 15,
    build: (src, out) => ({ compile: `gcc -std=gnu17 -O2 -pipe -o ${sh(out + "/prog")} ${sh(src + "/main.c")} -lm`, exec: sh(out + "/prog") }),
  },
  cpp: {
    image: "gcc:15",
    compileSeconds: 20,
    build: (src, out) => ({ compile: `g++ -std=gnu++20 -O2 -pipe -o ${sh(out + "/prog")} ${sh(src + "/main.cpp")}`, exec: sh(out + "/prog") }),
  },
  go: {
    // Built from docker/go/Dockerfile: golang plus a pre-compiled standard library cache.
    image: "defaang-go:1",
    compileSeconds: 20,
    build: (src, out) => ({
      compile:
        `if [ -d /gocache-seed ]; then cp -r /gocache-seed ${sh(out + "/gocache")} && export GOCACHE=${sh(out + "/gocache")}; fi; ` +
        `cd ${sh(src)} && CGO_ENABLED=0 go build -o ${sh(out + "/prog")} solution.go harness.go`,
      exec: sh(out + "/prog"),
    }),
  },
  rust: {
    image: "rust:1-slim-bookworm",
    compileSeconds: 30,
    build: (src, out) => ({ compile: `rustc --edition 2021 -O -C debuginfo=0 -A warnings -o ${sh(out + "/prog")} ${sh(src + "/main.rs")}`, exec: sh(out + "/prog") }),
  },
  java: {
    image: "eclipse-temurin:25-jdk",
    compileSeconds: 20,
    build: (src, out) => ({
      compile: `javac -nowarn -encoding UTF-8 -d ${sh(out + "/classes")} ${sh(src + "/Solution.java")} ${sh(src + "/Main.java")}`,
      exec: `java -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:-UsePerfData -Xss256m -cp ${sh(out + "/classes")} Main`,
    }),
  },
};

/** Images built locally rather than pulled: tag -> build context directory (relative to the repo root). */
export const LOCAL_IMAGES: Record<string, string> = { "defaang-go:1": "docker/go", "defaang-node-dev:1": "docker/node-dev" };

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

/** Exit code `timeout` uses when the program ran past the time limit. */
export const TIMEOUT_EXIT = 124;

function command(rt: LangRuntime, src: string, out: string, limit: number): string[] {
  if (rt.run) return rt.run(src);
  const { compile, exec } = rt.build!(src, out);
  return ["sh", "-c", `${compile} && exec timeout -k 1 ${limit} ${exec}`];
}

export async function execute(lang: Language, files: Record<string, string>, stdin: string): Promise<ExecResult> {
  const rt = RUNTIMES[lang];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "defaang-run-"));
  fs.chmodSync(dir, 0o755); // the container runs as an unprivileged user
  for (const [file, source] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), source, { mode: 0o644 });
  const name = `defaang-${randomUUID().slice(0, 12)}`;
  const limit = timeoutSec();
  const compiled = Boolean(rt.build);

  let bin: string;
  let args: string[];
  if (runnerMode() === "docker") {
    bin = "docker";
    args = [
      "run", "--rm", "-i", "--name", name,
      "--network", "none",
      "--memory", "512m", "--memory-swap", "512m",
      "--cpus", "1", "--pids-limit", "64",
      "--read-only", "--tmpfs", compiled ? "/tmp:size=384m,exec" : "/tmp:size=16m",
      "--ulimit", "stack=268435456:268435456",
      "--user", "65534:65534",
      "--security-opt", "no-new-privileges",
      "-e", "PYTHONDONTWRITEBYTECODE=1", "-e", "HOME=/tmp",
      "-v", `${dir}:/work:ro`, "-w", "/work",
      rt.image, ...command(rt, "/work", "/tmp", limit),
    ];
  } else {
    [bin, ...args] = command(rt, dir, dir, limit);
  }

  const started = Date.now();
  try {
    return await new Promise<ExecResult>((resolve, reject) => {
      const child = spawn(bin, args, {
        cwd: dir,
        env:
          runnerMode() === "local"
            ? { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: "1", HOME: dir, GOCACHE: path.join(os.tmpdir(), "defaang-gocache") }
            : process.env,
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      // Docker adds container start-up time and compiled languages need time to build, so the
      // wall-clock backstop sits beyond the program limit (which `timeout` enforces precisely).
      const wall = (limit + (rt.compileSeconds ?? 0) + (runnerMode() === "docker" ? 5 : 0)) * 1000;
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

export interface RunnerStatus {
  ready: boolean;
  message?: string;
  /** Languages whose runtime image is still being downloaded or built (docker mode). */
  pending: Language[];
}

const CORE: Language[] = ["python", "javascript", "typescript"];

/**
 * Checks the runner can work and starts fetching missing runtime images in the background.
 * The runner is "ready" once the core (Python/Node) images exist; compiled-language toolchains are
 * large, so they download in the background and are reported per language in `pending`.
 */
export async function checkRunner(): Promise<RunnerStatus> {
  if (runnerMode() === "local") return { ready: true, pending: [], message: "Local runner: code runs on this machine without isolation." };
  try {
    await execFileP("docker", ["info", "--format", "{{.ServerVersion}}"]);
  } catch {
    return { ready: false, pending: [], message: "Docker is not reachable. Start Docker or set DEFAANG_RUNNER=local in .env." };
  }
  const missing = new Set<string>();
  for (const img of new Set(Object.values(RUNTIMES).map((r) => r.image))) {
    if (!(await imageExists(img))) missing.add(img);
  }
  for (const img of missing) fetchImage(img);
  const pending = (Object.keys(RUNTIMES) as Language[]).filter((l) => missing.has(RUNTIMES[l].image));
  const corePending = pending.filter((l) => CORE.includes(l));
  if (corePending.length) return { ready: false, pending, message: `Pulling runtime images: ${[...new Set(corePending.map((l) => RUNTIMES[l].image))].join(", ")} (first run only)…` };
  return { ready: true, pending };
}

/** Fails fast with a helpful message when a language's image isn't available yet. */
export async function ensureRuntime(lang: Language): Promise<string | undefined> {
  return ensureImage(RUNTIMES[lang].image, `The ${lang} toolchain`);
}

/** Docker runner: undefined when the image is present; otherwise starts fetching (or building) it and says so. */
export async function ensureImage(img: string, what = "The image"): Promise<string | undefined> {
  if (runnerMode() === "local") return undefined;
  if (await imageExists(img)) return undefined;
  fetchImage(img);
  return `${what} (${img}) is still ${LOCAL_IMAGES[img] ? "being built" : "downloading"} in the background (first use only). Try again in a minute or two.`;
}

async function imageExists(img: string): Promise<boolean> {
  try {
    await execFileP("docker", ["image", "inspect", img]);
    return true;
  } catch {
    return false;
  }
}

const pulling = new Set<string>();
function fetchImage(img: string) {
  if (pulling.has(img)) return;
  pulling.add(img);
  const ctx = LOCAL_IMAGES[img];
  const args = ctx ? ["build", "-t", img, path.join(ROOT, ctx)] : ["pull", img];
  console.log(`[runner] docker ${args.join(" ")}`);
  execFile("docker", args, { maxBuffer: 64 * 1024 * 1024 }, (err) => {
    pulling.delete(img);
    console.log(err ? `[runner] failed to fetch ${img}: ${err.message}` : `[runner] ready: ${img}`);
  });
}
