import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CommandPreviewProps {
  command: string;
  className?: string;
}

export function CommandPreview({ command, className }: CommandPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex items-center gap-2 rounded-md border border-border bg-black/40 p-2 font-mono text-xs", className)}>
      <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <code className="flex-1 overflow-x-auto whitespace-pre text-green-400">{command}</code>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopy} title="Copy command">
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
