import { useEffect, useState, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Download, X, CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared";
import { useI18n } from "@/i18n";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { cn } from "@/lib/utils";

export function Downloads() {
  const { t } = useI18n();
  const { tasks, cancelTask, clearCompleted } = useDownloadsStore();
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    const setup = async () => {
      const prefixes = ["install", "build", "test", "upgrade"];
      for (const prefix of prefixes) {
        const exitUn = await listen<{ code: number; success: boolean; cancelled?: boolean; command: string }>(
          `${prefix}-exit`,
          (event) => {
            const payload = event.payload;
            useDownloadsStore.getState().completeTask(prefix, payload.success, payload.cancelled);
          }
        );
        unlistenRefs.current.push(exitUn);

        const stdoutUn = await listen<{ line: string }>(`${prefix}-stdout`, (event) => {
          useDownloadsStore.getState().updateTaskOutput(prefix, event.payload.line);
        });
        unlistenRefs.current.push(stdoutUn);
      }
    };
    setup();
    return () => {
      unlistenRefs.current.forEach(fn => fn());
    };
  }, []);

  const activeTasks = tasks.filter(t => t.status === "running");
  const completedTasks = tasks.filter(t => t.status !== "running");

  return (
    <div className="space-y-4">
      <PageHeader title={t("downloads.title")} description={t("downloads.desc")}>
        {completedTasks.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearCompleted}>
            {t("common.clear")}
          </Button>
        )}
      </PageHeader>

      {/* Active downloads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" /> {t("downloads.active")}
            <Badge variant="secondary">{activeTasks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTasks.length === 0 ? (
            <EmptyState message={t("downloads.noActive")} />
          ) : (
            <div className="space-y-3">
              {activeTasks.map(task => (
                <div key={task.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">{task.title}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancelTask(task.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-primary transition-all" />
                  </div>
                  <div className="mt-1 max-h-24 overflow-auto font-mono text-xs text-muted-foreground">
                    {task.output.slice(-5).map((line, i) => (
                      <div key={i} className="truncate">{line}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed downloads */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("downloads.completed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between rounded-md border border-border p-2">
                  <div className="flex items-center gap-2">
                    {task.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : task.status === "cancelled" ? (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={task.status === "completed" ? "success" : task.status === "cancelled" ? "secondary" : "destructive"}>
                      {t(`downloads.${task.status}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(task.startTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
