// Debugging questions: runs the candidate's project with its dev server (hot reloading), and runs
// terminal commands in the same environment.
//
// Docker runner: one container per session from the defaang-node-dev image (Node plus the project's
// npm dependencies, preinstalled), with the session's project folder bind-mounted at /app. Edits in
// the editor land in that folder, so the dev server reloads them. The dev server's port is published
// on 127.0.0.1 only. Unlike the code-running sandbox the container has a network (it must publish a
// port), but it has no capabilities, a memory/CPU/process cap, and runs as your user.
//
// Local runner: the dev server runs on this machine, in the session folder. Its npm dependencies
// resolve from de-faang's own node_modules (sessions/ sits inside the repo).

import { execFile, spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import type { AppStatus } from "../../shared/types.ts";
import { ROOT } from "../paths.ts";
import { ensureImage, runnerMode } from "../runner/execute.ts";
import { projectDir } from "./project.ts";

const execFileP = promisify(execFile);

export const DEV_IMAGE = "defaang-node-dev:1";
/** The dev server's port inside the container. */
const CONTAINER_PORT = 5173;
const MAX_LOG = 64 * 1024;
const START_TIMEOUT_MS = 90_000;
export const COMMAND_TIMEOUT_S = 120;
const MAX_OUTPUT = 256 * 1024;

export interface AppConfig {
  /** The dev server command, run in the project folder. */
  command: string[];
}

interface App {
  state: AppStatus["state"];
  url?: string;
  message?: string;
  logs: string;
  /** Docker: the container's name. Local: the dev server's process (group leader). */
  container?: string;
  proc?: ChildProcess;
  logProc?: ChildProcess;
  /** Local runner: the ports the app uses (the API port is also exported to terminal commands). */
  env?: Record<string, string>;
}

const apps = new Map<string, App>();
const containerName = (sessionId: string) => `defaang-app-${sessionId}`.replace(/[^a-zA-Z0-9_.-]/g, "-");
const uid = () => (typeof process.getuid === "function" ? `${process.getuid()}:${process.getgid!()}` : "1000:1000");

function appendLog(app: App, chunk: string) {
  app.logs = (app.logs + chunk).slice(-MAX_LOG);
}

export function appStatus(sessionId: string): AppStatus {
  const app = apps.get(sessionId);
  const mode = runnerMode();
  if (!app) return { state: "stopped", mode, logs: "" };
  return { state: app.state, mode, url: app.url, message: app.message, logs: app.logs };
}

export const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });

/** Starts the app if it isn't running (or restarts it). Resolves once it is starting; poll appStatus for readiness. */
export async function startApp(sessionId: string, config: AppConfig, restart = false): Promise<AppStatus> {
  const existing = apps.get(sessionId);
  if (existing && !restart && (existing.state === "running" || existing.state === "starting")) return appStatus(sessionId);
  if (existing) await stopApp(sessionId);
  const app: App = { state: "starting", logs: "" };
  apps.set(sessionId, app);
  try {
    if (runnerMode() === "docker") await startContainer(sessionId, app, config);
    else await startLocal(sessionId, app, config);
    void waitUntilReady(app);
  } catch (e) {
    app.state = "failed";
    app.message = (e as Error).message;
  }
  return appStatus(sessionId);
}

async function startContainer(sessionId: string, app: App, config: AppConfig) {
  const missing = await ensureImage(DEV_IMAGE);
  if (missing) throw new Error(missing);
  const name = containerName(sessionId);
  await execFileP("docker", ["rm", "-f", name]).catch(() => {});
  const hostPort = await freePort();
  await execFileP("docker", [
    "run", "-d", "--name", name,
    "--label", "defaang.app=1",
    "-p", `127.0.0.1:${hostPort}:${CONTAINER_PORT}`,
    "--memory", "1g", "--cpus", "2", "--pids-limit", "256",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--user", uid(),
    "-e", "HOME=/tmp", "-e", "HOST=0.0.0.0", "-e", `PORT=${CONTAINER_PORT}`, "-e", "API_PORT=3001", "-e", "npm_config_update_notifier=false",
    "-v", `${projectDir(sessionId)}:/app`, "-w", "/app",
    DEV_IMAGE, ...config.command,
  ]);
  app.container = name;
  app.url = `http://localhost:${hostPort}/`;
  const logs = spawn("docker", ["logs", "-f", name]);
  logs.stdout.on("data", (d) => appendLog(app, String(d)));
  logs.stderr.on("data", (d) => appendLog(app, String(d)));
  logs.on("close", () => {
    if (apps.get(sessionId) !== app || app.state === "stopped") return;
    // The container exited (e.g. the dev command crashed).
    void execFileP("docker", ["inspect", "-f", "{{.State.Running}} {{.State.ExitCode}}", name])
      .then(({ stdout }) => {
        if (stdout.startsWith("false")) {
          app.state = "failed";
          app.message = `The dev server exited (code ${stdout.split(" ")[1]?.trim()}). Check the logs, then restart it.`;
        }
      })
      .catch(() => {});
  });
  app.logProc = logs;
}

async function startLocal(sessionId: string, app: App, config: AppConfig) {
  const port = await freePort();
  const apiPort = await freePort();
  app.env = { PORT: String(port), API_PORT: String(apiPort), HOST: "127.0.0.1" };
  app.url = `http://localhost:${port}/`;
  const [cmd, ...args] = config.command;
  const proc = spawn(cmd, args, {
    cwd: projectDir(sessionId),
    env: { ...localEnv(), ...app.env },
    detached: true, // its own process group, so stopping it also stops the processes it starts
  });
  proc.stdout!.on("data", (d) => appendLog(app, String(d)));
  proc.stderr!.on("data", (d) => appendLog(app, String(d)));
  proc.on("error", (e) => {
    app.state = "failed";
    app.message = e.message;
  });
  proc.on("exit", (code) => {
    if (apps.get(sessionId) !== app || app.state === "stopped") return;
    app.state = "failed";
    app.message = `The dev server exited (code ${code}). Check the logs, then restart it.`;
  });
  app.proc = proc;
}

/** Environment for host processes: the repo's node_modules/.bin on PATH, and no secrets from .env. */
function localEnv(): NodeJS.ProcessEnv {
  const keep = ["PATH", "HOME", "LANG", "TERM", "TMPDIR", "SHELL", "USER", "SystemRoot", "TEMP", "TMP"];
  const env: NodeJS.ProcessEnv = Object.fromEntries(keep.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  env.PATH = [path.join(ROOT, "node_modules", ".bin"), process.env.PATH].filter(Boolean).join(path.delimiter);
  env.FORCE_COLOR = "0";
  env.npm_config_update_notifier = "false";
  return env;
}

async function waitUntilReady(app: App) {
  const started = Date.now();
  while (app.state === "starting") {
    try {
      const res = await fetch(app.url!, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        app.state = "running";
        app.message = undefined;
        return;
      }
    } catch {
      /* not up yet */
    }
    if (Date.now() - started > START_TIMEOUT_MS) {
      app.state = "failed";
      app.message = "The dev server didn't start within 90 seconds. Check the logs.";
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

export async function stopApp(sessionId: string) {
  const app = apps.get(sessionId);
  if (!app) return;
  app.state = "stopped";
  apps.delete(sessionId);
  app.logProc?.kill();
  if (app.container) await execFileP("docker", ["rm", "-f", app.container]).catch(() => {});
  if (app.proc?.pid) killGroup(app.proc.pid);
}

function killGroup(pid: number) {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

/** Stops every app (server shutdown), synchronously enough to run in an exit handler. */
export function stopAllApps() {
  for (const [id, app] of apps) {
    if (app.proc?.pid) killGroup(app.proc.pid);
    if (app.container) spawn("docker", ["rm", "-f", app.container], { stdio: "ignore", detached: true }).unref();
    apps.delete(id);
  }
}

/** Removes app containers left behind by an earlier server run that didn't shut down cleanly. */
export async function cleanupStaleApps() {
  if (runnerMode() !== "docker") return;
  try {
    const { stdout } = await execFileP("docker", ["ps", "-aq", "--filter", "label=defaang.app=1"]);
    const ids = stdout.split("\n").filter(Boolean);
    if (ids.length) await execFileP("docker", ["rm", "-f", ...ids]);
  } catch {
    /* docker not available */
  }
}

// ---------------------------------------------------------------- terminal

export interface CommandResult {
  exitCode: number | null;
  output: string;
  ms: number;
  timedOut: boolean;
}

/**
 * Runs one shell command from the project root, in the app's environment (inside its container with
 * the Docker runner). Commands can't read keyboard input. Output streams to `onOutput`.
 */
export async function runCommand(sessionId: string, config: AppConfig, command: string, onOutput: (s: string) => void, signal: AbortSignal): Promise<CommandResult> {
  const started = Date.now();
  let app = apps.get(sessionId);
  if (runnerMode() === "docker" && (!app?.container || app.state === "failed" || app.state === "stopped")) {
    onOutput("Starting the app's container first…\n");
    await startApp(sessionId, config, Boolean(app));
    app = apps.get(sessionId);
    if (!app?.container) throw Object.assign(new Error(app?.message ?? "The app's container didn't start."), { statusCode: 503 });
  }
  const pidFile = `/tmp/.defaang-term-${process.pid}-${Date.now()}.pid`;
  let bin: string;
  let args: string[];
  if (runnerMode() === "docker") {
    // The wrapper records its pid so the command can be stopped; `timeout` passes the signal on.
    bin = "docker";
    args = ["exec", "-i", "-w", "/app", "-u", uid(), "-e", "HOME=/tmp", "-e", "API_PORT=3001", app!.container!, "sh", "-c", `echo $$ > ${pidFile}; exec timeout -k 2 ${COMMAND_TIMEOUT_S} sh -c "$0"`, command];
  } else {
    bin = "sh";
    args = ["-c", command];
  }
  let output = "";
  let truncated = false;
  const emit = (d: Buffer | string) => {
    const s = String(d);
    if (output.length < MAX_OUTPUT) {
      output += s;
      onOutput(s);
    } else if (!truncated) {
      truncated = true;
      onOutput("\n[output truncated]\n");
    }
  };
  return await new Promise<CommandResult>((resolve) => {
    const child = spawn(bin, args, {
      cwd: projectDir(sessionId),
      env: runnerMode() === "docker" ? process.env : { ...localEnv(), ...(app?.env ?? {}) },
      detached: runnerMode() === "local",
    });
    let timedOut = false;
    const stop = () => {
      if (runnerMode() === "docker") spawn("docker", ["exec", app!.container!, "sh", "-c", `kill -TERM $(cat ${pidFile}) 2>/dev/null`], { stdio: "ignore" });
      else if (child.pid) killGroup(child.pid);
      setTimeout(() => child.kill("SIGKILL"), 3000).unref();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, (COMMAND_TIMEOUT_S + 5) * 1000);
    signal.addEventListener("abort", stop, { once: true });
    child.stdout.on("data", emit);
    child.stderr.on("data", emit);
    child.stdin.end();
    child.on("error", (e) => emit(`${e.message}\n`));
    child.on("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      const exitCode = code === 124 && runnerMode() === "docker" ? null : code;
      resolve({ exitCode, output, ms: Date.now() - started, timedOut: timedOut || (runnerMode() === "docker" && code === 124) });
    });
  });
}
