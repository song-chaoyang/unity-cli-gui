import { useState, useEffect } from "react";
import { Play, Square, FileText } from "lucide-react";
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

const BUILD_TARGETS = ["StandaloneOSX", "StandaloneWindows64", "StandaloneLinux64", "Android", "iOS", "WebGL", "tvOS", "PS5", "XboxSeriesX"];

export function Build() {
  const { t } = useI18n();
  const { projects } = useAppStore();
  const [project, setProject] = useState("");
  const [target, setTarget] = useState("StandaloneOSX");
  const [executeMethod, setExecuteMethod] = useState("Builder.PerformBuild");
  const [outputPath, setOutputPath] = useState("./Builds/MyApp");
  const [editorVersion, setEditorVersion] = useState("");
  const [architecture, setArchitecture] = useState("arm64");
  const [logFile, setLogFile] = useState("");
  const [allowInstall, setAllowInstall] = useState(false);
  const [noTail, setNoTail] = useState(false);
  const [extraArgs, setExtraArgs] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [androidExportType, setAndroidExportType] = useState("apk");
  const [allowDirtyBuild, setAllowDirtyBuild] = useState(false);
  const [versioningStrategy, setVersioningStrategy] = useState("none");
  const [buildHandle, setBuildHandle] = useState<ProcessHandle | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildFinished, setBuildFinished] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<string | null>(null);

  const showToast = useToastStore(s => s.addToast);

  useEffect(() => {
    const unlisten = listen<{ code: number; success: boolean }>("build-exit", (event) => {
      if (event.payload.success) showToast("success", t("build.success"));
      else showToast("error", `${t("build.failed")} (exit code ${event.payload.code})`);
      setBuildHandle(null);
      setBuildFinished(true);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [t]);

  const command = `unity build ${project || "<project>"} --target ${target} --execute-method ${executeMethod}${outputPath ? ` --output-path ${outputPath}` : ""}${editorVersion ? ` --editor-version ${editorVersion}` : ""}${architecture ? ` -a ${architecture}` : ""}${logFile ? ` --log-file ${logFile}` : ""}${allowInstall ? " --allow-install" : ""}${noTail ? " --no-tail" : ""}${target === "Android" ? ` --android-export-type ${androidExportType}` : ""}${versioningStrategy !== "none" ? ` --versioning-strategy ${versioningStrategy}` : ""}${allowDirtyBuild ? " --allow-dirty-build" : ""}${extraArgs ? ` --args "${extraArgs}"` : ""}`;

  const handleBuild = async () => {
    setBuilding(true); setDryRunResult(null); setBuildFinished(false);
    try {
      const extraArgsStr = [
        ...(target === "Android" ? [`--android-export-type=${androidExportType}`] : []),
        ...(versioningStrategy !== "none" ? [`--versioning-strategy=${versioningStrategy}`] : []),
        ...(allowDirtyBuild ? ["--allow-dirty-build"] : []),
        ...(extraArgs ? [extraArgs] : []),
      ].join(" ");
      const handle = await tauri.startBuild({
        project, target, executeMethod,
        outputPath: outputPath || undefined, editorVersion: editorVersion || undefined,
        architecture: architecture || undefined, logFile: logFile || undefined,
        allowInstall: allowInstall || undefined, noTail: noTail || undefined,
        extraArgs: extraArgsStr || undefined,
      });
      setBuildHandle(handle);
      showToast("success", t("build.started"));
    } catch (e: any) { showToast("error", e.message || t("build.failedStart")); }
    finally { setBuilding(false); }
  };

  const handleCancel = async () => {
    if (buildHandle) {
      try { await tauri.cancelProcess(buildHandle.id); showToast("success", t("build.cancelled")); }
      catch (e: any) { showToast("error", e.message); }
      setBuildHandle(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("build.title")} description={t("build.desc")} />

      <Card>
        <CardHeader><CardTitle>{t("build.config")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t("build.project")}</Label><Select value={project} onChange={e => setProject(e.target.value)} className="mt-1"><option value="">{t("build.selectProject")}</option>{projects.map(p => <option key={p.path} value={p.path}>{p.title}</option>)}</Select></div>
            <div><Label>{t("build.target")}</Label><Select value={target} onChange={e => setTarget(e.target.value)} className="mt-1">{BUILD_TARGETS.map(bt => <option key={bt} value={bt}>{bt}</option>)}</Select></div>
            <div><Label>{t("build.executeMethod")}</Label><Input value={executeMethod} onChange={e => setExecuteMethod(e.target.value)} placeholder="Builder.PerformBuild" className="mt-1" /></div>
            <div><Label>{t("build.outputPath")}</Label><Input value={outputPath} onChange={e => setOutputPath(e.target.value)} placeholder="./Builds/MyApp" className="mt-1" /></div>
          </div>
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-muted-foreground hover:text-foreground">{showAdvanced ? "▼" : "▶"} {t("build.advanced")}</button>
          {showAdvanced && (
            <div className="grid grid-cols-3 gap-4 rounded-md border border-border p-3">
              <div><Label>{t("build.editorVersion")}</Label><Input value={editorVersion} onChange={e => setEditorVersion(e.target.value)} placeholder={t("projects.defaultParams")} className="mt-1" /></div>
              <div><Label>{t("build.architecture")}</Label><Select value={architecture} onChange={e => setArchitecture(e.target.value)} className="mt-1"><option value="">{t("projects.defaultParams")}</option><option value="arm64">arm64</option><option value="x86_64">x86_64</option></Select></div>
              <div><Label>{t("build.logFile")}</Label><Input value={logFile} onChange={e => setLogFile(e.target.value)} placeholder={t("projects.defaultParams")} className="mt-1" /></div>
              <div><Label>{t("build.androidExport")}</Label><Select value={androidExportType} onChange={e => setAndroidExportType(e.target.value)} className="mt-1" disabled={target !== "Android"}><option value="apk">APK</option><option value="aab">AAB</option><option value="android-studio-project">Android Studio Project</option></Select></div>
              <div><Label>{t("build.versioning")}</Label><Select value={versioningStrategy} onChange={e => setVersioningStrategy(e.target.value)} className="mt-1"><option value="none">{t("projects.defaultParams")}</option><option value="semantic">Semantic</option><option value="tag">Tag</option><option value="custom">Custom</option></Select></div>
              <div><Label>{t("build.extraArgs")}</Label><Input value={extraArgs} onChange={e => setExtraArgs(e.target.value)} placeholder="-nographics -quit" className="mt-1" /></div>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={allowInstall} onChange={e => setAllowInstall(e.target.checked)} /> {t("build.allowInstall")}</label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={noTail} onChange={e => setNoTail(e.target.checked)} /> {t("build.noTail")}</label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={allowDirtyBuild} onChange={e => setAllowDirtyBuild(e.target.checked)} /> {t("build.dirtyBuild")}</label>
              </div>
            </div>
          )}
          <CommandPreview command={command} />
          {dryRunResult && (<div className="rounded-md border border-border bg-black/40 p-3"><p className="mb-1 text-xs text-muted-foreground">Dry Run:</p><code className="text-xs text-green-400">{dryRunResult}</code></div>)}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDryRunResult(command)}>Dry Run</Button>
            {buildHandle ? (<Button variant="destructive" onClick={handleCancel}><Square className="mr-2 h-3.5 w-3.5" /> {t("build.cancelBuild")}</Button>) : (<Button onClick={handleBuild} disabled={!project || !executeMethod || building}><Play className="mr-2 h-3.5 w-3.5" /> {building ? "..." : t("build.startBuild")}</Button>)}
          </div>
        </CardContent>
      </Card>
      {(buildHandle || building || buildFinished) && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> {t("build.output")}{buildHandle && <Badge variant="warning">PID: {buildHandle.id}</Badge>}{buildFinished && !buildHandle && <Badge variant="secondary">{t("common.close")}</Badge>}</CardTitle></CardHeader><CardContent><LogStream eventPrefix="build" height="400px" /></CardContent></Card>
      )}
    </div>
  );
}
