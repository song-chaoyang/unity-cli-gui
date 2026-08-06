import { useState, useEffect, useRef } from "react";
import { RefreshCw, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared";
import { LogStream } from "@/components/LogStream";
import { CommandPreview } from "@/components/CommandPreview";
import { useI18n } from "@/i18n";
import { useToastStore } from "@/stores/useToastStore";
import * as tauri from "@/lib/tauri";
import type { ProcessHandle } from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";

export function Logs() {
  const { t } = useI18n();
  const [level, setLevel] = useState("info");
  const [tail, setTail] = useState(50);
  const [following, setFollowing] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamHandle, setStreamHandle] = useState<ProcessHandle | null>(null);
  const streamHandleRef = useRef<ProcessHandle | null>(null);

  const showToast = useToastStore(s => s.addToast);

  useEffect(() => {
    const unlisten = listen<{ code: number; success: boolean }>("logs-exit", () => { setStreaming(false); setStreamHandle(null); streamHandleRef.current = null; });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => { return () => { if (streamHandleRef.current) tauri.cancelProcess(streamHandleRef.current.id).catch(() => {}); }; }, []);

  const command = `unity logs${following ? " --follow" : ""} --level ${level} --tail ${tail}`;

  const handleStart = async () => {
    try {
      const handle = await tauri.startLogStream({ follow: following, level, tail });
      setStreamHandle(handle); streamHandleRef.current = handle; setStreaming(true);
      showToast("success", t("logs.started"));
    } catch (e: any) { showToast("error", e.message); }
  };

  const handleStop = async () => {
    if (streamHandleRef.current) {
      try { await tauri.cancelProcess(streamHandleRef.current.id); showToast("success", t("logs.stopped")); }
      catch (e: any) { showToast("error", e.message); }
      setStreaming(false); setStreamHandle(null); streamHandleRef.current = null;
    }
  };

  const handleRestart = async () => { await handleStop(); setTimeout(handleStart, 200); };

  useEffect(() => { handleStart(); }, []);

  return (
    <div className="space-y-4">
      <PageHeader title={t("logs.title")} description={t("logs.desc")}>
        {streaming ? <Button variant="destructive" size="sm" onClick={handleStop}><Square className="mr-2 h-3.5 w-3.5" /> {t("logs.stop")}</Button>
        : <Button variant="outline" size="sm" onClick={handleStart}><RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("logs.start")}</Button>}
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>{t("logs.config")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div><Label>{t("logs.level")}</Label><Select value={level} onChange={e => setLevel(e.target.value)} className="mt-1" disabled={streaming}><option value="trace">Trace</option><option value="debug">Debug</option><option value="info">Info</option><option value="warn">Warn</option><option value="error">Error</option><option value="fatal">Fatal</option></Select></div>
          <div><Label>{t("logs.tailLines")}</Label><Select value={String(tail)} onChange={e => setTail(parseInt(e.target.value))} className="mt-1" disabled={streaming}><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="0">All</option></Select></div>
          <div><Label>{t("logs.follow")}</Label><div className="mt-1 flex items-center gap-2"><input type="checkbox" checked={following} onChange={e => setFollowing(e.target.checked)} id="follow" disabled={streaming} /><Label htmlFor="follow">{t("logs.streamNew")}</Label>{streaming && <Badge variant="success" className="pulse-dot ml-2">{t("logs.live")}</Badge>}</div></div>
        </CardContent>
      </Card>

      <CommandPreview command={command} />
      {streaming && <Button variant="outline" size="sm" onClick={handleRestart} className="mb-2"><RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("logs.restart")}</Button>}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">{t("logs.stream")}{streaming && <Badge variant="success" className="pulse-dot">{t("logs.live")}</Badge>}</CardTitle></CardHeader>
        <CardContent><LogStream eventPrefix="logs" height="500px" /></CardContent>
      </Card>
    </div>
  );
}
