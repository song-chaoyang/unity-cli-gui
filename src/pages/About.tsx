import { useEffect, useState } from "react";
import { Info, Github, ExternalLink, RefreshCw, Package, Bug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useToastStore } from "@/stores/useToastStore";
import * as tauri from "@/lib/tauri";

export function About() {
  const { t } = useI18n();
  const showToast = useToastStore(s => s.addToast);
  const [cliVersion, setCliVersion] = useState("—");
  const [envInfo, setEnvInfo] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const env = await tauri.getEnv();
        setEnvInfo(env);
        setCliVersion(env?.hubVersion || "—");
      } catch {}
    })();
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const info = await tauri.checkCliUpdate();
      setUpdateInfo(info);
    } catch {}
    setChecking(false);
  };

  const handleOpenRepo = () => {
    window.open("https://github.com/song-chaoyang/unity-cli-gui", "_blank");
  };

  const techStack = [
    { name: "Tauri", version: "2.x", desc: "Cross-platform desktop framework" },
    { name: "React", version: "18.x", desc: "UI framework" },
    { name: "TypeScript", version: "5.x", desc: "Type-safe JavaScript" },
    { name: "Rust", version: "stable", desc: "Backend language" },
    { name: "Tailwind CSS", version: "3.x", desc: "Utility-first CSS" },
    { name: "Zustand", version: "4.x", desc: "State management" },
    { name: "Vite", version: "5.x", desc: "Build tool" },
    { name: "reqwest", version: "0.12", desc: "HTTP client (Rust)" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Info className="h-5 w-5" />
          {t("about.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("about.desc")}</p>
      </div>

      {/* App info card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/20">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Unity CLI GUI</CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline">v0.3.0</Badge>
              <span className="text-xs text-muted-foreground">{t("about.unityCliVersion")}: {cliVersion}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t("about.description")}:</span>
              <p className="mt-1">{t("about.appDescription")}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t("about.license")}:</span>
              <p className="mt-1">MIT</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleCheckUpdate} disabled={checking}>
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
              {t("about.checkUpdate")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenRepo}>
              <Github className="mr-2 h-3.5 w-3.5" />
              {t("about.openRepo")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const title = prompt(t("about.bugTitle")); if (title && title.length >= 3) { const desc = prompt(t("about.bugDesc")); if (desc && desc.length >= 10) { tauri.submitBug({ title, description: desc }).then(() => showToast("success", t("about.bugSubmitted"))).catch((e: any) => showToast("error", e.message)); } } }}>
              <Bug className="mr-2 h-3.5 w-3.5" />
              {t("about.reportBug")}
            </Button>
          </div>
          {updateInfo && (
            <div className="rounded-md border border-border p-3 text-sm">
              {updateInfo.updateAvailable || updateInfo.currentVersion !== updateInfo.latestVersion ? (
                <span className="text-yellow-400">
                  ⬆ {t("settings.updateAvailable")} (v{updateInfo.latestVersion})
                </span>
              ) : (
                <span className="text-green-400">✓ {t("common.success")} — v{updateInfo.currentVersion}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tech stack card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("about.techStack")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {techStack.map(tech => (
              <div key={tech.name} className="flex items-center justify-between rounded-md border border-border p-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-xs font-bold">
                    {tech.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tech.name}</p>
                    <p className="text-xs text-muted-foreground">{tech.desc}</p>
                  </div>
                </div>
                <Badge variant="secondary">v{tech.version}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Environment info card */}
      {envInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("settings.env")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">{t("about.unityCliVersion")}:</span> {cliVersion}</div>
              <div><span className="text-muted-foreground">{t("settings.editorPath")}:</span> <code className="text-xs">{envInfo.editorInstallPath}</code></div>
              <div><span className="text-muted-foreground">{t("settings.cachePath")}:</span> <code className="text-xs">{envInfo.downloadCachePath}</code></div>
              <div><span className="text-muted-foreground">Platform:</span> {navigator.platform}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
