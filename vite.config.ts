import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist/web", emptyOutDir: true, chunkSizeWarningLimit: 8000 },
  server: {
    port: 5173,
    proxy: { "/api": { target: `http://localhost:${process.env.PORT ?? 4317}`, changeOrigin: true } },
  },
});
