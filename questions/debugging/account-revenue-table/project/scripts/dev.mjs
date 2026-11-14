// Starts the API (restarted on change by node --watch) and the Vite dev server (hot reloading).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const vite = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
const procs = [
  spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "--watch", "--watch-preserve-output", "server/index.js"], { stdio: "inherit" }),
  spawn(process.execPath, [vite, "--clearScreen", "false"], { stdio: "inherit" }),
];
const stop = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const p of procs) p.on("exit", (code) => {
  stop();
  process.exitCode = code ?? 0;
});
