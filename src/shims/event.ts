/**
 * Shim for @tauri-apps/api/event
 * Redirects listen() to the uTools preload bridge.
 * Maintains the same API surface: listen returns Promise<UnlistenFn>.
 */

export type UnlistenFn = () => void;

export interface Event<T> {
  event: string;
  id: number;
  payload: T;
}

export function listen<T = unknown>(
  eventName: string,
  handler: (event: Event<T>) => void
): Promise<UnlistenFn> {
  return (window as any).unityAPI.listen(eventName, handler);
}

export async function emit(eventName: string, payload?: unknown): Promise<void> {
  // Not used by the frontend, but included for API completeness
  (window as any).unityAPI.emit?.(eventName, payload);
}
