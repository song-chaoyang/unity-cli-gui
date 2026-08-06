import { useEffect, useState } from "react";
import { Star, Trash2, ArrowUpCircle, RefreshCw, Download, ChevronRight, ChevronDown, ExternalLink, Terminal as TerminalIcon, FileJson, MoreVertical, FolderCog, Check, Loader2, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/input";
import { LoadingSpinner, EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { CommandPreview } from "@/components/CommandPreview";
import { LogStream } from "@/components/LogStream";
import { ContextMenu, useContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { useAppStore } from "@/stores/useAppStore";
import { useToastStore } from "@/stores/useToastStore";
import { useI18n } from "@/i18n";
import * as tauri from "@/lib/tauri";
import type { Editor, Release } from "@/lib/tauri";
import { cn, copyToClipboard } from "@/lib/utils";

type Tab = "installed" | "available" | "running";

interface ModuleInfo {
  id: string;
  name: string;
  category: string;
  status: string;
  download: string;
  installed: string;
}

export function Editors() {
  const { t } = useI18n();
  const { editors, setEditors, setEditorsLoading, setEditorsError, editorStatuses, setStatuses } = useAppStore();
  const [tab, setTab] = useState<Tab>("installed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [releaseFilter, setReleaseFilter] = useState<{ lts: boolean; stream: string; limit: number }>({ lts: false, stream: "", limit: 20 });
  const [showInstall, setShowInstall] = useState(false);
  const [installVersion, setInstallVersion] = useState("");
  const [installArch, setInstallArch] = useState("arm64");
  const [installModules, setInstallModules] = useState("");
  const [installing, setInstalling] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [modulesMap, setModulesMap] = useState<Record<string, ModuleInfo[]>>({});
  const [modulesLoading, setModulesLoading] = useState<string | null>(null);
  const [moduleActionLoading, setModuleActionLoading] = useState<string | null>(null);
  const [showModuleSearch, setShowModuleSearch] = useState<string | null>(null);
  const [moduleSearch, setModuleSearch] = useState("");
  const { menu, open: openContextMenu, close: closeContextMenu } = useContextMenu();

  const showToast = useToastStore(s => s.addToast);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [eds, running] = await Promise.allSettled([tauri.listEditors(), tauri.getStatus()]);
      if (eds.status === "fulfilled") setEditors(eds.value);
      else { setEditorsError(eds.reason?.message || "Failed"); setError(eds.reason?.message || "Failed"); }
      if (running.status === "fulfilled") setStatuses(running.value);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const loadReleases = async () => {
    setReleasesLoading(true);
    try {
      const data = await tauri.listReleases({ lts: releaseFilter.lts || undefined, stream: releaseFilter.stream || undefined, limit: releaseFilter.limit });
      setReleases(data);
    } catch (e: any) { setError(e.message); }
    finally { setReleasesLoading(false); }
  };

  useEffect(() => { if (tab === "available") loadReleases(); }, [tab, releaseFilter.lts, releaseFilter.stream, releaseFilter.limit]);

  const loadModules = async (version: string) => {
    setModulesLoading(version);
    try {
      const result = await tauri.listModules(version);
      const mods: ModuleInfo[] = result?.data || result || [];
      setModulesMap(prev => ({ ...prev, [version]: mods }));
    } catch {}
    finally { setModulesLoading(null); }
  };

  const toggleExpand = (version: string) => {
    setExpandedPaths(prev => { const n = new Set(prev); if (n.has(version)) n.delete(version); else { n.add(version); if (!modulesMap[version]) loadModules(version); } return n; });
  };

  const handleInstall = async () => {
    if (!installVersion) return;
    setInstalling(true);
    try {
      const mods = installModules ? installModules.split(",").map(s => s.trim()) : undefined;
      await tauri.startInstallEditor({ version: installVersion, modules: mods, architecture: installArch });
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setInstalling(false); }
  };

  const handleAddModule = async (version: string, moduleId: string) => {
    setModuleActionLoading(moduleId);
    try {
      await tauri.addModules(version, [moduleId], undefined, true);
      showToast("success", t("editors.moduleAddSuccess"));
      await loadModules(version);
    } catch (e: any) { showToast("error", e.message); }
    finally { setModuleActionLoading(null); }
  };

  const handleRemoveModule = async (version: string, moduleId: string) => {
    setModuleActionLoading(moduleId);
    try {
      await tauri.removeModules(version, [moduleId]);
      showToast("success", t("editors.moduleRemoveSuccess"));
      await loadModules(version);
    } catch (e: any) { showToast("error", e.message); }
    finally { setModuleActionLoading(null); }
  };

  const handleRevealPath = async (version: string) => {
    try { const path = await tauri.editorPath(version); if (path) await tauri.revealInFileManager(path.trim()); }
    catch (e: any) { showToast("error", e.message); }
  };

  const handleOpenTerminal = async (version: string) => {
    try { const path = await tauri.editorPath(version); if (path) await tauri.openTerminalAtPath(path.trim()); }
    catch (e: any) { showToast("error", e.message); }
  };

  const handleOpenModuleJson = async (version: string) => {
    try {
      const path = await tauri.editorPath(version);
      if (path) {
        const moduleJson = path.trim() + "/modules.json";
        await tauri.openInEditor(moduleJson);
      }
    } catch (e: any) { showToast("error", e.message); }
  };

  const installCommand = installVersion ? `unity install ${installVersion}${installModules ? ` -m ${installModules}` : ""} -a ${installArch} --yes --accept-eula` : "unity install <version>";

  const buildContextMenu = (ed: Editor): ContextMenuItem[] => [
    { label: t("editors.ctxOpenPath"), icon: ExternalLink, onClick: () => handleRevealPath(ed.version) },
    { label: t("editors.ctxOpenTerminal"), icon: TerminalIcon, onClick: () => handleOpenTerminal(ed.version) },
    { label: t("editors.ctxModuleJson"), icon: FileJson, onClick: () => handleOpenModuleJson(ed.version) },
    { separator: true },
    { label: t("editors.ctxManageModules"), icon: FolderCog, onClick: () => { toggleExpand(ed.version); } },
    !ed.default ? { label: t("editors.ctxSetDefault"), icon: Star, onClick: async () => { try { await tauri.setDefaultEditor(ed.version); loadData(); } catch (e: any) { showToast("error", e.message); } } } : { label: `${t("editors.default")}: ${ed.version}`, icon: Star },
    ed.upgradeTo ? { label: `${t("editors.ctxUpgrade")} → ${ed.upgradeTo}`, icon: ArrowUpCircle, onClick: async () => { try { await tauri.editorsUpgrade(ed.version, true); loadData(); } catch (e: any) { showToast("error", e.message); } } } : undefined,
    { separator: true },
    { label: t("editors.ctxUninstall"), icon: Trash2, danger: true, onClick: async () => { if (confirm(`Uninstall Unity ${ed.version}?`)) { try { await tauri.uninstallEditor(ed.version); loadData(); } catch (e: any) { showToast("error", e.message); } } } },
  ].filter(Boolean) as ContextMenuItem[];

  // Group modules by category
  const getGroupedModules = (version: string): Record<string, ModuleInfo[]> => {
    const mods = modulesMap[version] || [];
    const groups: Record<string, ModuleInfo[]> = {};
    mods.forEach(m => { const cat = m.category || "Other"; if (!groups[cat]) groups[cat] = []; groups[cat].push(m); });
    return groups;
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("editors.title")} description={t("editors.desc")}>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("common.refresh")}</Button>
        <Button size="sm" onClick={() => setShowInstall(!showInstall)}><Download className="mr-2 h-3.5 w-3.5" /> {t("editors.installEditor")}</Button>
      </PageHeader>

      {error && <ErrorState message={error} />}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["installed", "available", "running"] as Tab[]).map(tabId => (
          <button key={tabId} onClick={() => setTab(tabId)}
            className={cn("px-4 py-2 text-sm font-medium capitalize transition-colors", tab === tabId ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}>
            {t(`editors.${tabId}`)}
          </button>
        ))}
      </div>

      {loading && tab === "installed" && <LoadingSpinner className="h-6 w-6" />}

      {/* Installed editors — expandable card list */}
      {tab === "installed" && !loading && (
        editors.length === 0 ? <EmptyState message={t("editors.noEditors")} /> : (
          <div className="space-y-2">
            {editors.map(ed => {
              const isExpanded = expandedPaths.has(ed.version);
              const grouped = isExpanded ? getGroupedModules(ed.version) : {};
              const mods = modulesMap[ed.version] || [];
              const installedMods = mods.filter(m => m.status === "已安装" || m.status.toLowerCase().includes("install"));
              return (
                <Card key={ed.version} className={cn("overflow-hidden transition-all", isExpanded && "border-primary/50")}>
                  {/* Main row */}
                  <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/30"
                    onClick={() => toggleExpand(ed.version)}
                    onContextMenu={e => openContextMenu(e, buildContextMenu(ed))}>
                    <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); toggleExpand(ed.version); }}>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium font-mono">{ed.version}</span>
                        {ed.default && <Badge variant="success">{t("editors.default")}</Badge>}
                        {ed.upgradeTo && <Badge variant="warning">→ {ed.upgradeTo}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {ed.modules ? `${installedMods.length || (ed.modules.split(",").length)} ${t("editors.modules").toLowerCase()}` : t("editors.noModules")} · {ed.location ? ed.location.replace(/\\/g, "/").split("/").slice(-2).join("/") : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{ed.architecture}</Badge>
                    <div className="flex shrink-0 gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("editors.ctxOpenPath")} onClick={() => handleRevealPath(ed.version)}><ExternalLink className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("editors.ctxManageModules")} onClick={() => toggleExpand(ed.version)}><FolderCog className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.preventDefault(); e.stopPropagation(); openContextMenu(e.nativeEvent, buildContextMenu(ed)); }}><MoreVertical className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>

                  {/* Expanded module management panel */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t("editors.moduleManage")}</span>
                        <Button variant="ghost" size="sm" onClick={() => loadModules(ed.version)} disabled={modulesLoading === ed.version}>
                          {modulesLoading === ed.version ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      {modulesLoading === ed.version ? <LoadingSpinner className="h-5 w-5" /> :
                       mods.length === 0 ? <p className="text-sm text-muted-foreground">{t("editors.noModules")}</p> : (
                        <div className="space-y-3">
                          {Object.entries(grouped).map(([category, catMods]) => (
                            <div key={category}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{category}</span>
                                <Badge variant="secondary" className="text-[10px]">{catMods.length}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-1">
                                {catMods.map(mod => {
                                  const isInstalled = mod.status === "已安装" || mod.status.toLowerCase().includes("install");
                                  const isLoading = moduleActionLoading === mod.id;
                                  return (
                                    <div key={mod.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs hover:bg-accent/30">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1">
                                          <span className="font-medium truncate">{mod.name}</span>
                                          {isInstalled ? <Check className="h-3 w-3 text-green-400" /> : null}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">{mod.download}{isInstalled ? ` · ${mod.installed}` : ""}</span>
                                      </div>
                                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : isInstalled ? (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" title={t("editors.moduleRemove")} onClick={() => handleRemoveModule(ed.version, mod.id)}>
                                          <X className="h-3 w-3" />
                                        </Button>
                                      ) : (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-green-400 shrink-0" title={t("editors.moduleAdd")} onClick={() => handleAddModule(ed.version, mod.id)}>
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Expanded detail */}
                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-3">
                        <div><span className="text-muted-foreground">{t("editors.path")}:</span> <code className="break-all">{ed.location || "—"}</code></div>
                        <div><span className="text-muted-foreground">{t("editors.arch")}:</span> {ed.architecture}</div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Available releases */}
      {tab === "available" && (
        <Card>
          <div className="flex items-center gap-4 border-b border-border p-3">
            <div className="flex items-center gap-2"><input type="checkbox" id="lts-only" checked={releaseFilter.lts} onChange={e => setReleaseFilter({ ...releaseFilter, lts: e.target.checked })} /><Label htmlFor="lts-only">{t("editors.ltsOnly")}</Label></div>
            <Select value={releaseFilter.stream} onChange={e => setReleaseFilter({ ...releaseFilter, stream: e.target.value })} className="w-32"><option value="">{t("editors.allStreams")}</option><option value="lts">LTS</option><option value="tech">Tech</option><option value="beta">Beta</option><option value="alpha">Alpha</option></Select>
            <Input type="number" value={releaseFilter.limit} onChange={e => setReleaseFilter({ ...releaseFilter, limit: parseInt(e.target.value) || 20 })} className="w-24" />
            {releasesLoading && <LoadingSpinner />}
          </div>
          <div className="divide-y divide-border">
            {releases.length === 0 && !releasesLoading ? <EmptyState message={t("editors.noReleases")} /> :
              releases.map(rel => (
                <div key={rel.version} className="flex items-center gap-3 p-3 hover:bg-accent/30">
                  <span className="font-mono text-sm flex-1">{rel.version}</span>
                  <Badge variant="outline">{rel.stream}</Badge>
                  {rel.lts && <Badge variant="success">LTS</Badge>}
                  <span className="text-xs text-muted-foreground hidden lg:inline">{rel.releaseDate || "—"}</span>
                  <Button variant="outline" size="sm" onClick={() => { setInstallVersion(rel.version); setShowInstall(true); }}><Download className="mr-1 h-3 w-3" /> {t("common.install")}</Button>
                </div>
              ))
            }
          </div>
        </Card>
      )}

      {/* Running editors */}
      {tab === "running" && (
        <Card>
          <div className="divide-y divide-border">
            {editorStatuses.length === 0 ? <EmptyState message={t("editors.noRunning")} /> :
              editorStatuses.map((st, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <span className="font-mono text-sm flex-1">{st.version || "—"}</span>
                  <span className="text-xs text-muted-foreground">{st.project || st.projectPath || "—"}</span>
                  <span className="font-mono text-xs">PID: {st.pid || "—"}</span>
                  <Badge variant={st.state === "ready" ? "success" : "secondary"}>{st.state || "—"}</Badge>
                </div>
              ))
            }
          </div>
        </Card>
      )}

      {/* Context menu */}
      {menu && <ContextMenu items={menu.items} x={menu.x} y={menu.y} onClose={closeContextMenu} />}

      {/* Install dialog */}
      {showInstall && (
        <Card className="border-primary/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> {t("editors.installEditor")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>{t("editors.version")}</Label><Input value={installVersion} onChange={e => setInstallVersion(e.target.value)} placeholder="6000.3.20f1" className="mt-1" /></div>
              <div><Label>{t("editors.arch")}</Label><Select value={installArch} onChange={e => setInstallArch(e.target.value)} className="mt-1"><option value="arm64">arm64</option><option value="x86_64">x86_64</option></Select></div>
              <div><Label>{t("editors.modules")}</Label><Input value={installModules} onChange={e => setInstallModules(e.target.value)} placeholder="android,ios,webgl" className="mt-1" /></div>
            </div>
            <CommandPreview command={installCommand} />
            {installing && <LogStream eventPrefix="install" height="200px" />}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowInstall(false)}>{t("common.cancel")}</Button><Button onClick={handleInstall} disabled={!installVersion || installing}>{installing ? t("editors.installing") : t("common.install")}</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
