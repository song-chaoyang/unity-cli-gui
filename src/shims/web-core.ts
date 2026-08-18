/**
 * Web shim for @tauri-apps/api/core
 * Redirects invoke() calls to the Node.js web server via HTTP fetch.
 * All frontend code imports from "@tauri-apps/api/core" unchanged —
 * web/vite.config.ts aliases the import here at build time.
 */

export function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return fetch("/api/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd, args: args || {} }),
  }).then(async (resp) => {
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || `Server error ${resp.status}`);
    }
    return resp.json() as Promise<T>;
  });
}
