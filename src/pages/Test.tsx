import { useState, useEffect } from "react";
import { Play, Square, FlaskConical, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared";
import { CommandPreview } from "@/components/CommandPreview";
import { LogStream } from "@/components/LogStream";
import { useAppStore } from "@/stores/useAppStore";
import { useToastStore } from "@/stores/useToastStore";
import { useI18n } from "@/i18n";
import * as tauri from "@/lib/tauri";
import type { ProcessHandle } from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";

export function Test() {
  const { t } = useI18n();
  const { projects } = useAppStore();
  const [project, setProject] = useState("");
  const [mode, setMode] = useState("EditMode");
  const [filter, setFilter] = useState("");
  const [output, setOutput] = useState("test-results.xml");
  const [editorVersion, setEditorVersion] = useState("");
  const [timeoutVal, setTimeoutVal] = useState(600);
  const [testHandle, setTestHandle] = useState<ProcessHandle | null>(null);
  const [starting, setStarting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; code: number } | null>(null);
  const [testFinished, setTestFinished] = useState(false);

  const showToast = useToastStore(s => s.addToast);

  useEffect(() => {
    const unlisten = listen<{ code: number; success: boolean }>("test-exit", (event) => {
      setTestResult({ success: event.payload.success, code: event.payload.code });
      if (event.payload.success) showToast("success", t("test.completed"));
      else showToast("error", `${t("test.failed")} (exit code ${event.payload.code})`);
      setTestHandle(null);
      setTestFinished(true);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [t]);

  const command = `unity test ${project || "<project>"} --mode ${mode}${filter ? ` --filter "${filter}"` : ""} --output ${output}${editorVersion ? ` --editor-version ${editorVersion}` : ""} --timeout ${timeoutVal}`;

  const handleRun = async () => {
    setStarting(true); setTestResult(null); setTestFinished(false);
    try {
      const handle = await tauri.startTest({ project, mode: mode || undefined, filter: filter || undefined, output: output || undefined, editorVersion: editorVersion || undefined, timeout: timeoutVal || undefined });
      setTestHandle(handle);
      showToast("success", t("test.started"));
    } catch (e: any) { showToast("error", e.message || t("test.failedStart")); }
    finally { setStarting(false); }
  };

  const handleCancel = async () => {
    if (testHandle) {
      try { await tauri.cancelProcess(testHandle.id); showToast("success", t("test.cancelled")); }
      catch (e: any) { showToast("error", e.message); }
      setTestHandle(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("test.title")} description={t("test.desc")} />

      <Card>
        <CardHeader><CardTitle>{t("test.config")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t("build.project")}</Label><Select value={project} onChange={e => setProject(e.target.value)} className="mt-1"><option value="">{t("build.selectProject")}</option>{projects.map(p => <option key={p.path} value={p.path}>{p.title}</option>)}</Select></div>
            <div><Label>{t("test.mode")}</Label><Select value={mode} onChange={e => setMode(e.target.value)} className="mt-1"><option value="EditMode">EditMode</option><option value="PlayMode">PlayMode</option></Select></div>
            <div><Label>{t("test.filter")}</Label><Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="MyNamespace.MyTests" className="mt-1" /></div>
            <div><Label>{t("test.output")}</Label><Input value={output} onChange={e => setOutput(e.target.value)} placeholder="test-results.xml" className="mt-1" /></div>
            <div><Label>{t("test.editorVersion")}</Label><Input value={editorVersion} onChange={e => setEditorVersion(e.target.value)} placeholder={t("projects.defaultParams")} className="mt-1" /></div>
            <div><Label>{t("test.timeout")}</Label><Input type="number" value={timeoutVal} onChange={e => setTimeoutVal(parseInt(e.target.value) || 600)} className="mt-1" /></div>
          </div>
          <CommandPreview command={command} />
          <div className="flex justify-end gap-2">
            {testHandle ? <Button variant="destructive" onClick={handleCancel}><Square className="mr-2 h-3.5 w-3.5" /> {t("test.cancel")}</Button>
            : <Button onClick={handleRun} disabled={!project || starting}><Play className="mr-2 h-3.5 w-3.5" /> {starting ? "..." : t("test.run")}</Button>}
          </div>
        </CardContent>
      </Card>

      {(testHandle || testFinished) && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> {t("test.output2")}{testHandle && <Badge variant="warning">PID: {testHandle.id}</Badge>}{testFinished && !testHandle && <Badge variant="secondary">{t("common.close")}</Badge>}</CardTitle></CardHeader><CardContent><LogStream eventPrefix="test" height="400px" /></CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("test.results")}</CardTitle></CardHeader>
        <CardContent>
          {testResult ? (
            <div className="space-y-2">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><CheckCircle className={cn("h-5 w-5", testResult.success ? "text-green-400" : "text-muted-foreground")} /><span className="text-sm">{t("test.passed")}: <span className="font-bold">{testResult.success ? "✓" : "—"}</span></span></div>
                <div className="flex items-center gap-2"><XCircle className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{t("test.failed")}: <span className="font-bold">{testResult.success ? "—" : "✓"}</span></span></div>
                <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" /><span className="text-sm">Exit Code: <span className="font-bold">{testResult.code}</span></span></div>
              </div>
              <p className="text-xs text-muted-foreground">NUnit XML: {output}</p>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{t("test.passed")}: <span className="font-bold">—</span></span></div>
              <div className="flex items-center gap-2"><XCircle className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{t("test.failed")}: <span className="font-bold">—</span></span></div>
              <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{t("test.skipped")}: <span className="font-bold">—</span></span></div>
              <p className="text-xs text-muted-foreground">{t("test.placeholder")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
