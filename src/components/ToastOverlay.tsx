import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { useToastStore } from "@/stores/useToastStore";
import { cn } from "@/lib/utils";

export function ToastOverlay() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-10 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-md border-2 px-4 py-2.5 text-sm shadow-2xl min-w-[280px] max-w-[400px]",
            toast.type === "success" && "border-green-500 bg-green-950 text-green-400",
            toast.type === "error" && "border-red-500 bg-red-950 text-red-400",
            toast.type === "info" && "border-blue-500 bg-blue-950 text-blue-400",
          )}
        >
          {toast.type === "success" && <CheckCircle className="h-4 w-4 shrink-0" />}
          {toast.type === "error" && <XCircle className="h-4 w-4 shrink-0" />}
          {toast.type === "info" && <Info className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => removeToast(toast.id)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
