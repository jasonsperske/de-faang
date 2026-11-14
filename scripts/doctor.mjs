#!/usr/bin/env node
// de-faang doctor: checks the system dependencies the app needs and says how to fix what's missing.
//
//   npm run doctor            (or: node scripts/doctor.mjs)
//   npm run doctor -- --quick skip the sandbox smoke test
//
// Plain Node with no npm dependencies, so it works before `npm install` (which it also checks).
// It never prints API key values and makes no network calls except to the local Docker daemon and,
// if something is listening on the app's port, to that local server.

import { execFile } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Toolchains per language: Docker image (must match server/runner/execute.ts) and host commands for DEFAANG_RUNNER=local. */
export const TOOLCHAINS = {
  python: { image: "python:3.12-slim", local: [["python3", "--version"]] },
  javascript: { image: "node:22-slim", local: [["node", "--version"]] },
  typescript: { image: "node:22-slim", local: [["node", "--version"]] },
  c: { image: "gcc:15", local: [["gcc", "--version"], ["timeout", "--version"]] },
  cpp: { image: "gcc:15", local: [["g++", "--version"], ["timeout", "--version"]] },
  go: { image: "defaang-go:1", local: [["go", "version"], ["timeout", "--version"]] },
  rust: { image: "rust:1-slim-bookworm", local: [["rustc", "--version"], ["timeout", "--version"]] },
  java: { image: "eclipse-temurin:25-jdk", local: [["javac", "-version"], ["java", "-version"], ["timeout", "--version"]] },
};
/** Images built from this repo instead of pulled. */
export const LOCAL_IMAGES = { "defaang-go:1": "docker/go" };
const CORE = ["python", "javascript", "typescript"];

// ------------------------------------------------------------------------------- output

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const ICON = { ok: paint(32, "✓"), warn: paint(33, "!"), fail: paint(31, "✗"), info: paint(36, "·") };
const counts = { ok: 0, warn: 0, fail: 0, info: 0 };

function report(level, title, detail, fix) {
  counts[level]++;
  console.log(`  ${ICON[level]} ${title}${detail ? paint(90, ` — ${detail}`) : ""}`);
  if (fix && level !== "ok") console.log(`      ${paint(36, "→")} ${fix}`);
}
const section = (name) => console.log(`\n${paint(1, name)}`);

// ------------------------------------------------------------------------------- helpers

function run(cmd, args, timeout = 15_000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ ok: !err, code: err?.code, stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), missing: err?.code === "ENOENT" }),
    );
  });
}
const firstLine = (s) => s.trim().split("\n")[0] ?? "";

/** Parses .env (KEY=value lines; no interpolation). Values are used only to test presence. */
function readDotEnv() {
  const f = path.join(ROOT, ".env");
  if (!fs.existsSync(f)) return null;
  const env = {};
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}

function versionAtLeast(have, want) {
  const a = have.split(".").map(Number);
  const b = want.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

const portFree = (port) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });

const gb = (bytes) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

// ------------------------------------------------------------------------------- checks

function checkNode() {
  section("Node.js");
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const want = (pkg.engines?.node ?? ">=22.6").replace(/^>=\s*/, "");
  const have = process.versions.node;
  if (versionAtLeast(have, want)) report("ok", `Node ${have}`, `needs ${want} or newer`);
  else report("fail", `Node ${have} is too old`, `needs ${want} or newer (TypeScript type stripping)`, "Install Node 22 LTS or newer, e.g. with nvm: nvm install 22");

  const missing = ["fastify", "tsx", "vite", "react", "@anthropic-ai/sdk"].filter((p) => !fs.existsSync(path.join(ROOT, "node_modules", p, "package.json")));
  if (!fs.existsSync(path.join(ROOT, "node_modules"))) report("fail", "npm packages not installed", undefined, "npm install");
  else if (missing.length) report("fail", "npm packages incomplete", `missing ${missing.join(", ")}`, "npm install");
  else report("ok", "npm packages installed");
}

function checkConfig() {
  section("Configuration");
  const fileEnv = readDotEnv();
  if (fileEnv) report("ok", ".env found");
  else report("warn", "No .env file", "using only shell environment variables", "cp .env.example .env, then add at least one API key");
  const env = { ...(fileEnv ?? {}), ...process.env };
  const set = (...keys) => keys.some((k) => (env[k] ?? "").trim() !== "");

  if (env.DEFAANG_MOCK_LLM === "1") report("warn", "Mock LLM mode is on (DEFAANG_MOCK_LLM=1)", "interviewer and evaluator return canned text", "Remove DEFAANG_MOCK_LLM from .env for real interviews");
  const providers = [
    ["Claude", set("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"), "ANTHROPIC_API_KEY"],
    ["Codex", set("OPENAI_API_KEY"), "OPENAI_API_KEY"],
    ["Gemini", set("GEMINI_API_KEY", "GOOGLE_API_KEY"), "GEMINI_API_KEY"],
    ["Muse", set("META_API_KEY", "MODEL_API_KEY"), "META_API_KEY"],
  ];
  const available = providers.filter(([, ok]) => ok).map(([name]) => name);
  if (available.length) report("ok", `LLM providers configured: ${available.join(", ")}`, providers.filter(([, ok]) => !ok).length ? `not set: ${providers.filter(([, ok]) => !ok).map(([, , k]) => k).join(", ")}` : undefined);
  else if (env.DEFAANG_MOCK_LLM === "1") report("info", "No LLM provider keys set", "fine in mock mode");
  else report("fail", "No LLM provider key set", "the interviewer and evaluator need at least one", "Add ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY or META_API_KEY to .env");

  const timeout = Number(env.DEFAANG_RUN_TIMEOUT ?? 10);
  if (!Number.isFinite(timeout) || timeout <= 0) report("fail", `DEFAANG_RUN_TIMEOUT=${env.DEFAANG_RUN_TIMEOUT} is not a positive number`, undefined, "Set DEFAANG_RUN_TIMEOUT=10 in .env");

  const sessions = path.join(ROOT, "sessions");
  try {
    fs.mkdirSync(sessions, { recursive: true });
    fs.accessSync(sessions, fs.constants.W_OK);
    report("ok", "sessions/ is writable");
  } catch (e) {
    report("fail", "sessions/ is not writable", e.message, `Fix the permissions on ${sessions}`);
  }
  return env;
}

async function checkDocker(quick) {
  section("Code runner: Docker (DEFAANG_RUNNER=docker)");
  const v = await run("docker", ["--version"]);
  if (v.missing) {
    report("fail", "Docker CLI not found", undefined, "Install Docker (https://docs.docker.com/get-docker/), or set DEFAANG_RUNNER=local in .env (no isolation)");
    return;
  }
  report("ok", firstLine(v.stdout));

  const info = await run("docker", ["info", "--format", "{{.ServerVersion}}|{{.DockerRootDir}}|{{.CgroupVersion}}"]);
  if (!info.ok) {
    const err = info.stderr + info.stdout;
    if (/permission denied/i.test(err)) report("fail", "No permission to use the Docker daemon", undefined, "sudo usermod -aG docker $USER, then log out and back in");
    else report("fail", "Docker daemon not reachable", firstLine(err), "Start Docker (e.g. sudo systemctl start docker, or open Docker Desktop)");
    return;
  }
  const [server, rootDir, cgroup] = info.stdout.trim().split("|");
  report("ok", `Docker daemon ${server}`, cgroup ? `cgroup v${cgroup}` : undefined);

  const images = [...new Set(Object.values(TOOLCHAINS).map((t) => t.image))];
  const present = {};
  let missingBytes = 0;
  for (const img of images) {
    const r = await run("docker", ["image", "inspect", "--format", "{{.Size}}", img]);
    present[img] = r.ok;
    if (!r.ok) missingBytes += img.startsWith("python") || img.startsWith("node") ? 0.2e9 : 1.2e9;
  }
  for (const img of images) {
    const langs = Object.entries(TOOLCHAINS).filter(([, t]) => t.image === img).map(([l]) => l);
    const core = langs.some((l) => CORE.includes(l));
    const fix = LOCAL_IMAGES[img] ? `docker build -t ${img} ${LOCAL_IMAGES[img]}` : `docker pull ${img}`;
    if (present[img]) report("ok", `${img}`, langs.join(", "));
    else if (core) report("fail", `${img} not downloaded`, `${langs.join(", ")}; the app pulls it on start, but nothing runs until it's there`, `${fix}  (or npm run docker:pull for everything)`);
    else report("warn", `${img} not downloaded`, `${langs.join(", ")} unavailable until it's fetched (the app does this in the background)`, `${fix}  (or npm run docker:pull for everything)`);
  }

  if (missingBytes > 0 && rootDir && fs.statfsSync) {
    try {
      const st = fs.statfsSync(rootDir);
      const free = st.bavail * st.bsize;
      const need = missingBytes * 2.5; // compressed download plus extracted layers
      if (free < need) report("warn", `Low disk space for Docker images`, `${gb(free)} free in ${rootDir}, about ${gb(need)} needed`, "Free some space, e.g. docker system prune");
      else report("ok", "Disk space for missing images", `${gb(free)} free`);
    } catch {
      /* the Docker root may not be readable (e.g. Docker Desktop's VM); skip */
    }
  }

  if (quick) return report("info", "Sandbox smoke test skipped (--quick)");
  if (!present["python:3.12-slim"]) return report("info", "Sandbox smoke test skipped", "python:3.12-slim isn't downloaded yet");
  // Same isolation flags the runner uses (server/runner/execute.ts), so cgroup or rootless issues show up here.
  const smoke = await run(
    "docker",
    ["run", "--rm", "--network", "none", "--memory", "512m", "--memory-swap", "512m", "--cpus", "1", "--pids-limit", "64", "--read-only", "--tmpfs", "/tmp:size=16m", "--user", "65534:65534", "--security-opt", "no-new-privileges", "python:3.12-slim", "python3", "-c", "print(6*7)"],
    60_000,
  );
  if (smoke.ok && smoke.stdout.trim() === "42") report("ok", "Sandboxed container runs", "no network, read-only, 512 MB, 1 CPU, unprivileged user");
  else report("fail", "Sandboxed container failed to run", firstLine(smoke.stderr || smoke.stdout), "Check that Docker supports memory/CPU limits (cgroups); see the error above");
}

async function checkLocal() {
  section("Code runner: local (DEFAANG_RUNNER=local)");
  report("warn", "Local runner has no isolation", "candidate code runs directly on this machine", "Prefer DEFAANG_RUNNER=docker unless you trust all code you run");
  if (!(await run("sh", ["-c", "true"])).ok) report("fail", "sh not found", "needed for compiled languages");
  const cache = new Map();
  for (const [lang, t] of Object.entries(TOOLCHAINS)) {
    const missing = [];
    let version = "";
    for (const [cmd, ...args] of t.local) {
      if (!cache.has(cmd)) cache.set(cmd, await run(cmd, args));
      const r = cache.get(cmd);
      if (r.missing) missing.push(cmd);
      else if (!version) version = firstLine(r.stdout || r.stderr);
    }
    if (!missing.length) report("ok", lang, version);
    else report(CORE.includes(lang) ? "fail" : "warn", `${lang} unavailable`, `missing ${missing.join(", ")}`, `Install ${missing.join(" and ")} (or switch to DEFAANG_RUNNER=docker)`);
  }
}

async function checkPorts(env) {
  section("Ports");
  const port = Number(env.PORT ?? 4317);
  if (await portFree(port)) report("ok", `Port ${port} is free`, "API and production UI");
  else {
    let ours = false;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/config`, { signal: AbortSignal.timeout(2000) });
      ours = res.ok && Array.isArray((await res.json()).providers);
    } catch {
      /* not an HTTP server, or not ours */
    }
    if (ours) report("ok", `de-faang is already running on port ${port}`, `http://localhost:${port}`);
    else report("fail", `Port ${port} is in use by another program`, undefined, `Stop it, or set PORT to a free port in .env`);
  }
  if (await portFree(5173)) report("ok", "Port 5173 is free", "Vite dev server for npm run dev");
  else report("info", "Port 5173 is in use", "npm run dev's UI server will pick another port");
}

// ------------------------------------------------------------------------------- main

export async function main(argv = process.argv.slice(2)) {
  const quick = argv.includes("--quick");
  console.log(paint(1, "de-faang doctor") + paint(90, `  ${ROOT}`));
  checkNode();
  const env = checkConfig();
  if (env.DEFAANG_RUNNER === "local") await checkLocal();
  else await checkDocker(quick);
  await checkPorts(env);

  console.log(
    `\n${counts.fail ? paint(31, `${counts.fail} problem${counts.fail === 1 ? "" : "s"}`) : paint(32, "No problems")}` +
      `${counts.warn ? `, ${paint(33, `${counts.warn} warning${counts.warn === 1 ? "" : "s"}`)}` : ""}. ` +
      (counts.fail ? "Fix the items marked ✗ above." : "You're ready: npm start (or npm run dev)."),
  );
  return counts.fail ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
