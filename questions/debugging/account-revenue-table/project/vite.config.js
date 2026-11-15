import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = Number(process.env.API_PORT ?? 3001);
// Dependencies may be installed above the project folder (e.g. a shared /node_modules).
const nodeModules = path.dirname(path.dirname(createRequire(import.meta.url).resolve("vite/package.json")));

/** The API restarts itself when server/ changes (node --watch); reload the page once it's back. */
function reloadOnApiChange() {
  const serverDir = path.resolve("server") + path.sep;
  return {
    name: "reload-on-api-change",
    configureServer(server) {
      server.watcher.add(serverDir);
      let timer;
      server.watcher.on("change", (file) => {
        if (!file.startsWith(serverDir)) return;
        clearTimeout(timer);
        timer = setTimeout(() => server.ws.send({ type: "full-reload" }), 800);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), reloadOnApiChange()],
  server: {
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    // Polling keeps hot reloading working on bind-mounted folders (Docker Desktop on macOS and Windows).
    watch: { usePolling: true, interval: 300 },
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
    fs: { allow: [".", nodeModules] },
  },
});
