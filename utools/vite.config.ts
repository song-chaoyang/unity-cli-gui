import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// uTools plugin Vite config — used for BOTH dev server and production build.
//
// Dev mode (pnpm dev:utools):
//   Vite dev server on port 1421 with HMR. plugin.json main → http://localhost:1421
//   Edit code → HMR updates instantly, no build, no restart needed.
//
// Build mode (pnpm build:utools):
//   Produces utools/dist/ for marketplace release. Switch plugin.json main → dist/index.html.
const root = path.resolve(__dirname, "..");

export default defineConfig({
  plugins: [react()],
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@tauri-apps/api/core": path.resolve(root, "src/shims/core.ts"),
      "@tauri-apps/api/event": path.resolve(root, "src/shims/event.ts"),
      "@tauri-apps/plugin-dialog": path.resolve(root, "src/shims/dialog.ts"),
    },
  },
  base: "./",
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
