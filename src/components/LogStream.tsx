import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Pause, Play, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LogLine {
  text: string;
  type: "stdout" | "stderr";
  timestamp: number;
}

interface LogStreamProps {
  eventPrefix: string;
  className?: string;
  height?: string;
}

export function LogStream({ eventPrefix, className, height = "300px" }: LogStreamProps) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  // Use a ref for paused state to avoid stale closure bug in event listeners
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setup = async () => {
      const stdoutUn = await listen<{ line: string }>(`${eventPrefix}-stdout`, (event) => {
        if (!pausedRef.current) {
          setLines((prev) => [...prev, { text: event.payload.line, type: "stdout", timestamp: Date.now() }]);
        }
      });
      unlisteners.push(stdoutUn);

      const stderrUn = await listen<{ line: string }>(`${eventPrefix}-stderr`, (event) => {
        if (!pausedRef.current) {
          setLines((prev) => [...prev, { text: event.payload.line, type: "stderr", timestamp: Date.now() }]);
        }
      });
      unlisteners.push(stderrUn);

      const exitUn = await listen<{ code: number; success: boolean; cancelled?: boolean }>(
        `${eventPrefix}-exit`,
        (event) => {
          const msg = event.payload.cancelled
            ? `[Process cancelled]`
            : event.payload.success
              ? `[Process exited successfully (code ${event.payload.code})]`
              : `[Process exited with code ${event.payload.code}]`;
          setLines((prev) => [...prev, { text: msg, type: event.payload.success ? "stdout" : "stderr", timestamp: Date.now() }]);
        }
      );
      unlisteners.push(exitUn);
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [eventPrefix]); // Only depend on eventPrefix, not paused (use ref instead)

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const filteredLines = filter
    ? lines.filter((l) => l.text.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <div className={cn("flex flex-col rounded-md border border-border bg-black/40", className)}>
      <div className="flex items-center gap-2 border-b border-border p-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setPaused(!paused)}
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setLines([])}
          title="Clear"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-7 pl-8 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground">{filteredLines.length} lines</span>
      </div>
      <div
        ref={containerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
        }}
        className="overflow-auto p-2 font-mono text-xs"
        style={{ height }}
      >
        {filteredLines.length === 0 ? (
          <span className="text-muted-foreground">Waiting for output...</span>
        ) : (
          filteredLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "log-line",
                line.type === "stderr" && "log-line-error",
                /\bwarn(ing)?\b/i.test(line.text) && "log-line-warn",
                /\bdebug\b/i.test(line.text) && "log-line-debug"
              )}
            >
              {line.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
