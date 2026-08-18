/**
 * Web shim for @tauri-apps/api/event
 * Redirects listen() to a shared SSE (Server-Sent Events) connection.
 *
 * The Node.js server sends events as:
 *   data: {"event":"build-stdout","payload":{"line":"..."}}\n\n
 *
 * This shim maintains a single EventSource and routes events to
 * registered handlers by event name — matching the Tauri listen() API.
 */

export type UnlistenFn = () => void;

export interface Event<T> {
  event: string;
  id: number;
  payload: T;
}

// Map of eventName → Set of handlers
const handlers = new Map<string, Set<(payload: any) => void>>();
let sse: EventSource | null = null;
let nextId = 0;

function ensureSSE(): void {
  if (sse) return;

  sse = new EventSource("/api/events");

  sse.onmessage = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      const fns = handlers.get(data.event);
      if (fns) {
        for (const fn of fns) {
          fn(data.payload);
        }
      }
    } catch (err) {
      console.error("SSE parse error:", err);
    }
  };

  sse.onerror = () => {
    // EventSource auto-reconnects; just log
    console.warn("SSE connection error — will auto-reconnect");
  };
}

export function listen<T = unknown>(
  eventName: string,
  handler: (event: Event<T>) => void
): Promise<UnlistenFn> {
  const id = nextId++;
  // Wrap handler to match the Event<T> interface
  const wrapped = (payload: T) => handler({ event: eventName, id, payload });

  if (!handlers.has(eventName)) {
    handlers.set(eventName, new Set());
  }
  handlers.get(eventName)!.add(wrapped);

  ensureSSE();

  return Promise.resolve(() => {
    handlers.get(eventName)?.delete(wrapped);
  });
}

export async function emit(_eventName: string, _payload?: unknown): Promise<void> {
  // Not used by the frontend; included for API completeness
}
