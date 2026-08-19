import { useEffect, useState } from "react";
import { Info, RefreshCw, Package, Bug, Github, Star, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { useToastStore } from "@/stores/useToastStore";
import * as tauri from "@/lib/tauri";

export function About() {
  const { t } = useI18n();
  const showToast = useToastStore(s => s.addToast);
  const [showBugForm, setShowBugForm] = useState(false);
  const [bugTitle, setBugTitle] = useState("");
  const [bugDesc, setBugDesc] = useState("");
  const [submittingBug, setSubmittingBug] = useState(false);
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

  const techStack = [
    { name: "React", version: "18.x", desc: "UI framework" },
    { name: "TypeScript", version: "5.x", desc: "Type-safe JavaScript" },
    { name: "Tailwind CSS", version: "3.x", desc: "Utility-first CSS" },
    { name: "Zustand", version: "4.x", desc: "State management" },
    { name: "Vite", version: "5.x", desc: "Build tool" },
    { name: "lucide-react", version: "—", desc: "Icon library" },
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
              <Badge variant="outline">v0.0.1</Badge>
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
            <Button variant="outline" size="sm" onClick={() => setShowBugForm(!showBugForm)}>
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

      {/* Repository & Star card */}
      <Card className="border-primary/30">
        <CardContent className="flex items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{t("about.repository")}</p>
              <a
                href={t("about.repoUrl")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {t("about.repoUrl")}
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="mt-1 text-xs text-muted-foreground">{t("about.starHint")}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => window.open(t("about.repoUrl"), "_blank")}
          >
            <Star className="mr-1.5 h-3.5 w-3.5" />
            {t("about.starRepo")}
          </Button>
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
      {/* Bug report form */}
      {showBugForm && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Bug className="h-4 w-4" /> {t("about.reportBug")}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowBugForm(false)}>✕</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{t("about.bugTitle")}</Label>
              <Input value={bugTitle} onChange={e => setBugTitle(e.target.value)} placeholder={t("about.bugTitle")} className="mt-1" />
            </div>
            <div>
              <Label>{t("about.bugDesc")}</Label>
              <Textarea value={bugDesc} onChange={e => setBugDesc(e.target.value)} placeholder={t("about.bugDesc")} className="mt-1 min-h-[80px]" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBugForm(false)}>{t("common.cancel")}</Button>
              <Button disabled={bugTitle.length < 3 || bugDesc.length < 10 || submittingBug} onClick={async () => {
                setSubmittingBug(true);
                try {
                  await tauri.submitBug({ title: bugTitle, description: bugDesc });
                  showToast("success", t("about.bugSubmitted"));
                  setShowBugForm(false);
                  setBugTitle("");
                  setBugDesc("");
                } catch (e: any) {
                  showToast("error", e.message);
                } finally {
                  setSubmittingBug(false);
                }
              }}>{submittingBug ? "..." : t("common.save")}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
