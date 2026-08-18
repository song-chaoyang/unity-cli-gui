import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { LogIn, LogOut, Globe, Server, BarChart3, HardDrive, RefreshCw, Download, Trash2, FileText, Stethoscope, Package, Info, Sun, Moon, Monitor, Key, FolderCog, Activity, Terminal as TerminalIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { SUPPORTED_LANGS, type Lang } from "@/i18n/translations";
import { useAppStore } from "@/stores/useAppStore";
import { useToastStore } from "@/stores/useToastStore";
import { useTheme } from "@/stores/useTheme";
import * as tauri from "@/lib/tauri";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { authInfo, setAuthInfo, envInfo, setEnvInfo, cacheInfo, setCacheInfo, unityAvailable, unityPath, recheckUnityAvailable } = useAppStore();
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyBypass, setProxyBypass] = useState("");
  const [analyticsOpt, setAnalyticsOpt] = useState<string | null>(null);
  const [doctorOutput, setDoctorOutput] = useState<string | null>(null);
  const [diagnoseOutput, setDiagnoseOutput] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hubInfo, setHubInfo] = useState<{ installed: boolean; path: string } | null>(null);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [licenses, setLicenses] = useState<any>(null);
  const [installPath, setInstallPath] = useState<string>("");
  const [showLicenseActivate, setShowLicenseActivate] = useState(false);
  const [manualActivate, setManualActivate] = useState(false);
  const [generatingAlf, setGeneratingAlf] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [alfGenerated, setAlfGenerated] = useState(false);
  const [licenseSerial, setLicenseSerial] = useState("");
  const [diagTab, setDiagTab] = useState<"doctor" | "diagnose">("doctor");
  const [cliLog, setCliLog] = useState<string[]>([]);
  const [cliBusy, setCliBusy] = useState(false);
  const showToast = useToastStore(s => s.addToast);

  useEffect(() => {
    (async () => {
      try {
        const [auth, env, cache, proxy, analytics, update, hub, lic, lics, ip] = await Promise.allSettled([
          tauri.authStatus(),
          tauri.getEnv(),
          tauri.cacheInfo(),
          tauri.getProxy(),
          tauri.analyticsStatus(),
          tauri.checkCliUpdate(),
          tauri.checkHubInstalled(),
          tauri.licenseStatus(),
          tauri.listLicenses(),
          tauri.getInstallPath(),
        ]);
        if (auth.status === "fulfilled") {
          const a = auth.value;
          if (a?.loggedIn) {
            setAuthInfo({ loggedIn: true, name: a.user?.name, email: a.user?.email });
          }
        } else {
          try {
            const retry = await tauri.authStatus();
            if (retry?.loggedIn) {
              setAuthInfo({ loggedIn: true, name: retry.user?.name, email: retry.user?.email });
            }
          } catch {}
        }
        if (env.status === "fulfilled") setEnvInfo(env.value);
        if (cache.status === "fulfilled") setCacheInfo(cache.value);
        if (proxy.status === "fulfilled") setProxyUrl(proxy.value?.url || "");
        if (analytics.status === "fulfilled") setAnalyticsOpt(analytics.value?.optedIn ? "opted-in" : "opted-out");
        if (update.status === "fulfilled") setUpdateInfo(update.value);
        if (hub.status === "fulfilled") setHubInfo(hub.value);
        if (lic.status === "fulfilled") setLicenseInfo(lic.value);
        if (lics.status === "fulfilled") setLicenses(lics.value);
        if (ip.status === "fulfilled" && ip.value) {
          const path = typeof ip.value === "string" ? ip.value : ip.value?.data?.path || ip.value?.path || "";
          setInstallPath(path);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Listen for CLI install/uninstall streaming events
  useEffect(() => {
    const unlistens: UnlistenFn[] = [];
    const prefixes = ["cli-install", "cli-uninstall"];
    prefixes.forEach(prefix => {
      listen<{ line: string }>(`${prefix}-stdout`, (e) => setCliLog(prev => [...prev, e.payload.line])).then(fn => unlistens.push(fn));
      listen<{ line: string }>(`${prefix}-stderr`, (e) => setCliLog(prev => [...prev, e.payload.line])).then(fn => unlistens.push(fn));
      listen<{ code: number; success: boolean }>(`${prefix}-exit`, (e) => {
        setCliBusy(false);
        const ok = e.payload.success;
        setCliLog(prev => [...prev, `[${prefix}] exit code ${e.payload.code} ${ok ? "✓" : "✗"}`]);
        if (!ok) { showToast("error", t("common.error")); return; }
        if (prefix === "cli-install") {
          // Retry detection with delays — newly installed binary may not be on PATH yet
          [1000, 3000, 5000].forEach((delay, i) => {
            setTimeout(async () => {
              await recheckUnityAvailable();
              if (useAppStore.getState().unityAvailable) {
                showToast("success", t("settings.cliInstalled"));
              } else if (i === 2) {
                showToast("info", t("settings.restartNeeded"));
              }
            }, delay);
          });
        } else {
          recheckUnityAvailable().then(() => showToast("success", t("settings.cliUninstalled")));
        }
      }).then(fn => unlistens.push(fn));
    });
    return () => { unlistens.forEach(fn => fn()); };
  }, []);

  const handleDoctor = async () => {
    setLoading(true); setDiagTab("doctor");
    try { const r = await tauri.runDoctor(); setDoctorOutput(r); } catch (e: any) { setDoctorOutput(`Error: ${e.message}`); } finally { setLoading(false); }
  };
  const handleDiagnose = async () => {
    setLoading(true); setDiagTab("diagnose");
    try { const r = await tauri.runDiagnose(); setDiagnoseOutput(r); } catch (e: any) { setDiagnoseOutput(`Error: ${e.message}`); } finally { setLoading(false); }
  };
  const handleChangelog = async () => {
    setLoading(true);
    try { const r = await tauri.getChangelog(); setChangelog(r); } catch (e: any) { setChangelog(`Error: ${e.message}`); } finally { setLoading(false); }
  };
  const handleLangChange = (newLang: Lang) => { setLang(newLang); tauri.setLanguage(newLang).catch(() => {}); };
  const handleBrowseInstallPath = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: t("settings.editorPath") });
      if (selected) { setInstallPath(selected as string); await tauri.setInstallPath(selected as string); }
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.desc")}</p>
      </div>

      {/* Authentication */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><LogIn className="h-4 w-4" /> {t("settings.auth")}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            {authInfo?.loggedIn ? (<><p className="text-sm font-medium">{authInfo.name}</p><p className="text-xs text-muted-foreground">{authInfo.email}</p></>) : (<p className="text-sm text-muted-foreground">{t("dash.notLoggedIn")}</p>)}
          </div>
          <div className="flex gap-2">
            {authInfo?.loggedIn ? (<Button variant="outline" size="sm" onClick={() => tauri.authLogout()}><LogOut className="mr-2 h-3.5 w-3.5" /> {t("settings.logout")}</Button>) : (<Button size="sm" disabled={loginBusy} onClick={async () => {
              setLoginBusy(true);
              try {
                const result = await invoke<{ authUrl: string | null }>("start_auth_login", {});
                if (result?.authUrl) {
                  window.open(result.authUrl, "_blank");
                  showToast("info", t("auth.loginWebHint"));
                }
                for (let i = 0; i < 90; i++) {
                  await new Promise(r => setTimeout(r, 2000));
                  try {
                    const status = await tauri.authStatus();
                    if (status?.loggedIn) {
                      setAuthInfo({ loggedIn: true, name: status.user?.name, email: status.user?.email });
                      showToast("success", t("auth.loginSuccess"));
                      break;
                    }
                  } catch {}
                }
              } catch (e: any) {
                showToast("error", e.message);
              } finally {
                setLoginBusy(false);
              }
            }}>{loginBusy ? <span className="mr-1 h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> : <LogIn className="mr-2 h-3.5 w-3.5" />} {loginBusy ? t("auth.waitingForLogin") : t("settings.login")}</Button>)}
          </div>
        </CardContent>
      </Card>

      {/* License Management */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Key className="h-4 w-4" /> {t("license.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">{t("license.status")}:</span> {licenseInfo?.active ? <Badge variant="success">{t("license.active")}</Badge> : <Badge variant="secondary">{t("license.noLicense")}</Badge>}</div>
            <div><span className="text-muted-foreground">{t("license.type")}:</span> {licenseInfo?.licenses?.[0]?.product || licenseInfo?.licenses?.[0]?.type || "—"}</div>
            <div><span className="text-muted-foreground">{t("license.expiry")}:</span> {licenseInfo?.licenses?.[0]?.expires || "—"}</div>
            <div><span className="text-muted-foreground">{t("settings.auth")}:</span> {licenseInfo?.authMode || "—"}</div>
          </div>
          {showLicenseActivate && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div><Label>{t("license.serial")}</Label><Input value={licenseSerial} onChange={e => setLicenseSerial(e.target.value)} placeholder={t("license.serialPlaceholder")} className="mt-1" /></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={async () => {
                  try {
                    await tauri.licenseActivate({ personal: true, acceptEula: true });
                    setShowLicenseActivate(false); showToast("success", t("license.active"));
                    const st = await tauri.licenseStatus(); setLicenseInfo(st);
                  } catch (e: any) {
                    // CLI activation failed — try manual activation via Unity Editor
                    showToast("info", t("license.cliFailed"));
                    setManualActivate(true);
                  }
                }}>{t("license.activatePersonal")}</Button>
                <Button size="sm" disabled={!licenseSerial} onClick={async () => { try { await tauri.licenseActivate({ serial: licenseSerial, acceptEula: true }); setShowLicenseActivate(false); setLicenseSerial(""); const st = await tauri.licenseStatus(); setLicenseInfo(st); } catch (e: any) { showToast("error", e.message); } }}>{t("license.activateSerial")}</Button>
                <Button size="sm" variant="outline" onClick={() => setShowLicenseActivate(false)}>{t("common.cancel")}</Button>
              </div>
            </div>
          )}
          {manualActivate && (
            <div className="space-y-3 rounded-md border border-primary/50 p-3">
              <div className="text-sm font-medium">{t("license.manualActivation")}</div>
              <p className="text-xs text-muted-foreground">{t("license.manualHint")}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={generatingAlf} onClick={async () => {
                  setGeneratingAlf(true);
                  try {
                    const result = await invoke<{ fileName: string; content: string }>("generate_license_request", {});
                    // Download the .alf file
                    const blob = new Blob([result.content], { type: "application/xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = result.fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast("success", t("license.alfGenerated"));
                    setAlfGenerated(true);
                  } catch (e: any) { showToast("error", e.message); }
                  finally { setGeneratingAlf(false); }
                }}>
                  {generatingAlf ? "..." : t("license.generateAlf")}
                </Button>
              </div>
              {alfGenerated && (
                <>
                  <div className="text-xs text-muted-foreground">
                    1. {t("license.step1")}<br/>
                    2. {t("license.step2")}<br/>
                    3. {t("license.step3")}
                  </div>
                  <div>
                    <Label>{t("license.selectUlf")}</Label>
                    <Input type="file" accept=".ulf,.xml" className="mt-1" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const content = reader.result as string;
                        // Write to a temp path on server
                        const tmpPath = `/tmp/${file.name}`;
                        await invoke("write_file_content", { path: tmpPath, content });
                        try {
                          const result = await invoke<{ success: boolean; stdout: string }>("activate_license_file", { path: tmpPath });
                          if (result.success) {
                            showToast("success", t("license.activated"));
                            setManualActivate(false);
                            const st = await tauri.licenseStatus();
                            setLicenseInfo(st);
                          } else {
                            showToast("error", result.stdout || "Activation failed");
                          }
                        } catch (e: any) { showToast("error", e.message); }
                      };
                      reader.readAsText(file);
                    }} />
                  </div>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => setManualActivate(false)}>{t("common.cancel")}</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!showLicenseActivate && !manualActivate && <Button variant="outline" size="sm" onClick={() => setShowLicenseActivate(true)}><Key className="mr-2 h-3.5 w-3.5" /> {t("license.activate")}</Button>}
            {!manualActivate && <Button variant="outline" size="sm" onClick={() => setManualActivate(true)}><FileText className="mr-2 h-3.5 w-3.5" /> {t("license.manualActivate")}</Button>}
            <Button variant="outline" size="sm" onClick={async () => { try { await tauri.licenseReturn(); showToast("success", t("license.return")); const st = await tauri.licenseStatus(); setLicenseInfo(st); } catch (e: any) { showToast("error", e.message); } }}>{t("license.return")}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sun className="h-4 w-4" /> {t("theme.title")}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}><Moon className="mr-2 h-3.5 w-3.5" /> {t("theme.dark")}</Button>
            <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}><Sun className="mr-2 h-3.5 w-3.5" /> {t("theme.light")}</Button>
            <Button variant={theme === "system" ? "default" : "outline"} size="sm" onClick={() => setTheme("system")}><Monitor className="mr-2 h-3.5 w-3.5" /> {t("theme.system")}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4" /> {t("settings.language")}</CardTitle></CardHeader>
        <CardContent><Select value={lang} onChange={e => handleLangChange(e.target.value as Lang)} className="w-48">{SUPPORTED_LANGS.map(l => <option key={l.code} value={l.code}>{l.nativeName}</option>)}</Select></CardContent>
      </Card>

      {/* Editor Install Path */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FolderCog className="h-4 w-4" /> {t("settings.editorPath")}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-1">
            <Input value={installPath} onChange={e => setInstallPath(e.target.value)} className="flex-1" />
            <Button variant="outline" size="icon" onClick={handleBrowseInstallPath}><FolderCog className="h-4 w-4" /></Button>
            <Button size="sm" onClick={() => tauri.setInstallPath(installPath)}>{t("common.save")}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Environment info */}
      {envInfo && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-4 w-4" /> {t("settings.env")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">{t("settings.hubVersion")}:</span> {envInfo.hubVersion}</div>
              <div><span className="text-muted-foreground">{t("settings.editorPath")}:</span> <code className="text-xs">{envInfo.editorInstallPath}</code></div>
              <div><span className="text-muted-foreground">{t("settings.userData")}:</span> <code className="text-xs">{envInfo.userDataPath}</code></div>
              <div><span className="text-muted-foreground">{t("settings.cachePath")}:</span> <code className="text-xs">{envInfo.downloadCachePath}</code></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proxy */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4" /> {t("settings.proxy")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t("settings.proxyUrl")}</Label><Input value={proxyUrl} onChange={e => setProxyUrl(e.target.value)} placeholder="http://user:pass@host:8080" className="mt-1" /></div>
            <div><Label>{t("settings.bypass")}</Label><Input value={proxyBypass} onChange={e => setProxyBypass(e.target.value)} placeholder="localhost,127.0.0.1" className="mt-1" /></div>
          </div>
          <div className="flex gap-2"><Button size="sm" onClick={() => tauri.setProxy(proxyUrl, proxyBypass || undefined)}>{t("common.save")}</Button><Button size="sm" variant="outline" onClick={() => tauri.unsetProxy()}>{t("common.clear")}</Button></div>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> {t("settings.analytics")}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("settings.status")}: <Badge variant={analyticsOpt === "opted-in" ? "success" : "secondary"}>{analyticsOpt || "—"}</Badge></p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { tauri.analyticsOptIn(); setAnalyticsOpt("opted-in"); }}>{t("settings.optIn")}</Button>
            <Button variant="outline" size="sm" onClick={() => { tauri.analyticsOptOut(); setAnalyticsOpt("opted-out"); }}>{t("settings.optOut")}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Cache management */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> {t("settings.cacheMgmt")}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>{cacheInfo ? (<><p className="text-sm font-medium">{cacheInfo.size} ({cacheInfo.fileCount} files)</p><p className="text-xs text-muted-foreground">{cacheInfo.path}</p></>) : <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}</div>
          <Button variant="outline" size="sm" onClick={() => tauri.cacheClean().then(() => tauri.cacheInfo().then(setCacheInfo))}><Trash2 className="mr-2 h-3.5 w-3.5" /> {t("settings.cleanCache")}</Button>
        </CardContent>
      </Card>

      {/* CLI management */}
      <Card>
        <CardHeader><CardTitle>{t("settings.cliMgmt")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Badge variant={updateInfo?.updateAvailable ? "warning" : "success"}>v1.0.0-beta.3</Badge>{updateInfo?.updateAvailable && <span className="text-xs text-yellow-400">{t("settings.updateAvailable")}</span>}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleChangelog}><FileText className="mr-2 h-3.5 w-3.5" /> {t("settings.changelog")}</Button>
              <Button variant="outline" size="sm" onClick={() => tauri.checkCliUpdate().then(setUpdateInfo)}><RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("settings.checkUpdate")}</Button>
              <Button size="sm" onClick={() => tauri.startCliUpgrade(true)}><Download className="mr-2 h-3.5 w-3.5" /> {t("settings.upgradeCli")}</Button>
            </div>
          </div>
          {changelog && (<div className="max-h-60 overflow-auto rounded-md border border-border p-3"><pre className="whitespace-pre-wrap text-xs text-muted-foreground">{changelog}</pre></div>)}
        </CardContent>
      </Card>

      {/* Unity Hub management */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-4 w-4" /> Unity Hub</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>{hubInfo === null ? (<p className="text-sm text-muted-foreground">{t("common.loading")}</p>) : hubInfo.installed ? (<><p className="text-sm font-medium flex items-center gap-2"><Badge variant="success">✓ {t("settings.hubInstalled")}</Badge></p>{hubInfo.path && <p className="text-xs text-muted-foreground mt-1">{hubInfo.path}</p>}<p className="text-xs text-muted-foreground mt-1">{t("settings.uninstallHubDesc")}</p></>) : (<><p className="text-sm font-medium flex items-center gap-2"><Badge variant="secondary">{t("settings.hubNotInstalled")}</Badge></p><p className="text-xs text-muted-foreground mt-1">{t("settings.installHubDesc")}</p></>)}</div>
          <div className="flex gap-2">{hubInfo?.installed ? (<Button variant="outline" size="sm" onClick={() => { if (confirm(t("settings.uninstallHubDesc"))) alert("Please uninstall Unity Hub manually from your system's application manager."); }}><Trash2 className="mr-2 h-3.5 w-3.5" /> {t("settings.uninstallHub")}</Button>) : (<Button size="sm" onClick={() => tauri.installHub()}><Download className="mr-2 h-3.5 w-3.5" /> {t("settings.installHub")}</Button>)}</div>
        </CardContent>
      </Card>

      {/* Diagnostics */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" /> {t("settings.diagnostics")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant={diagTab === "doctor" ? "default" : "outline"} size="sm" onClick={handleDoctor} disabled={loading}><Activity className="mr-2 h-3.5 w-3.5" /> {t("settings.runDoctor")}</Button>
            <Button variant={diagTab === "diagnose" ? "default" : "outline"} size="sm" onClick={handleDiagnose} disabled={loading}><Stethoscope className="mr-2 h-3.5 w-3.5" /> Diagnose</Button>
          </div>
          {diagTab === "doctor" && doctorOutput && (<div className="max-h-96 overflow-auto rounded-md border border-border p-3"><pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">{doctorOutput}</pre></div>)}
          {diagTab === "diagnose" && diagnoseOutput && (<div className="max-h-96 overflow-auto rounded-md border border-border p-3"><pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">{diagnoseOutput}</pre></div>)}
        </CardContent>
      </Card>

      {/* Unity CLI management — prominent install path + conditional install/uninstall */}
      <Card className={unityAvailable ? "" : "border-primary/50"}>
        <CardHeader><CardTitle className="flex items-center gap-2"><TerminalIcon className="h-4 w-4" /> Unity CLI</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {/* Status + path */}
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={unityAvailable ? "success" : "destructive"}>
                  {unityAvailable ? "✓ " + t("settings.cliInstalled") : "✗ " + t("settings.cliNotFound")}
                </Badge>
              </div>
              {unityAvailable && unityPath && (
                <p className="mt-1 text-xs text-muted-foreground font-mono break-all">{unityPath}</p>
              )}
              {!unityAvailable && (
                <p className="mt-1 text-xs text-muted-foreground">{t("settings.installCliDesc")}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {unityAvailable ? (
                <Button variant="destructive" size="sm" disabled={cliBusy} onClick={async () => {
                  if (!confirm(t("settings.uninstallCliDesc"))) return;
                  setCliBusy(true); setCliLog([]);
                  try { await tauri.startCliUninstall(false); } catch (e: any) { setCliBusy(false); showToast("error", e.message); }
                }}><Trash2 className="mr-2 h-3.5 w-3.5" /> {t("settings.uninstallCli")}</Button>
              ) : (
                <Button size="sm" disabled={cliBusy} onClick={async () => {
                  setCliBusy(true); setCliLog([]);
                  try { await tauri.installUnityCli(); } catch (e: any) { setCliBusy(false); showToast("error", e.message); }
                }}><Download className="mr-2 h-3.5 w-3.5" /> {t("settings.installCli")}</Button>
              )}
            </div>
          </div>
          {/* Manual install commands (shown when CLI not installed) */}
          {!unityAvailable && (
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <p className="mb-1 text-xs text-muted-foreground">{t("settings.manualInstall")}:</p>
              <pre className="whitespace-pre-wrap break-all text-xs font-mono text-muted-foreground">{navigator.platform.includes("Win") ? "$env:UNITY_CLI_CHANNEL='beta'; irm https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.ps1 | iex" : "curl -fsSL https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.sh | UNITY_CLI_CHANNEL=beta bash"}</pre>
            </div>
          )}
          {/* Streaming log output */}
          {cliLog.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-md border border-border bg-black/40 p-2">
              <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">{cliLog.join("\n")}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone — only shown when Unity CLI is installed */}
      {unityAvailable && (
      <Card className="border-destructive/50">
        <CardHeader><CardTitle className="text-destructive">{t("settings.dangerZone")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-destructive">{t("settings.uninstallCli")}</p><p className="text-xs text-muted-foreground">{t("settings.uninstallCliDesc")}</p></div>
            <Button variant="destructive" size="sm" disabled={cliBusy} onClick={async () => {
              if (!confirm(t("settings.uninstallCliDesc"))) return;
              setCliBusy(true); setCliLog([]);
              try { await tauri.startCliUninstall(false); } catch (e: any) { setCliBusy(false); showToast("error", e.message); }
            }}>{t("settings.uninstallCli")}</Button>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
