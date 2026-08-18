import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Web server Vite config — used for BOTH dev server and production build.
//
// Dev mode (pnpm dev:web):
//   Vite dev server on port 1422 with HMR.
//   Start server: pnpm dev:web (frontend HMR)
//   In another terminal: node web/server.mjs (backend API + SSE)
//   Or: pnpm serve:web (starts server which proxies / to Vite dev server)
//
// Build mode (pnpm build:web):
//   Produces dist/ with the web-optimized build. Server serves these files.
const root = path.resolve(__dirname, "..");

export default defineConfig({
  plugins: [react()],
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@tauri-apps/api/core": path.resolve(root, "src/shims/web-core.ts"),
      "@tauri-apps/api/event": path.resolve(root, "src/shims/web-event.ts"),
      "@tauri-apps/plugin-dialog": path.resolve(root, "src/shims/web-dialog.ts"),
    },
  },
  base: "./",
  clearScreen: false,
  server: {
    port: 1422,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // Proxy /api to the Node.js server during dev
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(root, "dist"),
    emptyOutDir: true,
  },
});
