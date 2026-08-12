/**
 * Shim for @tauri-apps/api/core
 * Redirects invoke() calls to the uTools preload bridge (window.unityAPI).
 * All original frontend code continues to import from "@tauri-apps/api/core"
 * unchanged — Vite alias resolves here at build time.
 */

export function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return (window as any).unityAPI.invoke(cmd, args || {});
}
