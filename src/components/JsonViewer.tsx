import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface JsonViewerProps {
  data: unknown;
  name?: string;
  level?: number;
  defaultExpanded?: boolean;
}

export function JsonViewer({ data, name, level = 0, defaultExpanded = true }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || level < 2);

  if (data === null) {
    return <span className="json-null">null</span>;
  }

  if (typeof data === "string") {
    return <span className="json-string">"{data}"</span>;
  }

  if (typeof data === "number") {
    return <span className="json-number">{data}</span>;
  }

  if (typeof data === "boolean") {
    return <span className="json-boolean">{data ? "true" : "false"}</span>;
  }

  const isArray = Array.isArray(data);
  const entries = isArray
    ? data.map((v, i) => [i, v] as const)
    : Object.entries(data as Record<string, unknown>);

  const empty = entries.length === 0;

  return (
    <span>
      {name !== undefined && (
        <>
          <span className="json-key">{name}</span>
          <span className="text-muted-foreground">: </span>
        </>
      )}
      {empty ? (
        <span className="text-muted-foreground">{isArray ? "[]" : "{}"}</span>
      ) : (
        <>
          <span
            className="cursor-pointer select-none text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ChevronDown className="inline h-3 w-3" /> : <ChevronRight className="inline h-3 w-3" />}
            {isArray ? "[" : "{"}
          </span>
          {expanded ? (
            <div className={cn("pl-4", level === 0 && "")}>
              {entries.map(([key, value], i) => (
                <div key={String(key)}>
                  <JsonViewer data={value} name={isArray ? undefined : String(key)} level={level + 1} />
                  {i < entries.length - 1 && <span className="text-muted-foreground">,</span>}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground"> {entries.length} {isArray ? "items" : "keys"} </span>
          )}
          <span className="text-muted-foreground">{isArray ? "]" : "}"}</span>
        </>
      )}
    </span>
  );
}
