import { useEffect, useState } from "react";
import { Star, Trash2, FolderOpen, ArrowUpCircle, HardDrive, RefreshCw, Plus, Info, GitBranch, FolderPlus, MoreVertical, Settings2, ExternalLink, ChevronUp, ChevronDown, Search, Terminal as TerminalIcon, Code2, Copy, Check, GitCommit, Cloud, ChevronRight, Download, Upload, Link2, Unlink, GitPullRequest } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label, Textarea } from "@/components/ui/input";
import { LoadingSpinner, EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { CommandPreview } from "@/components/CommandPreview";
import { ContextMenu, useContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { useAppStore } from "@/stores/useAppStore";
import { useToastStore } from "@/stores/useToastStore";
import { useI18n } from "@/i18n";
import * as tauri from "@/lib/tauri";
import type { Project, ProjectMeta } from "@/lib/tauri";
import { formatDate, cn, copyToClipboard, formatBytes } from "@/lib/utils";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

type SortField = "title" | "version" | "modified";
type SortDir = "asc" | "desc";

const EMOJI_CHOICES = ["🎮", "🕹️", "🎯", "🚀", "⭐", "🔥", "💡", "🎨", "🛠️", "📦", "🏗️", "⚡", "🌟", "🎪", "🎲", "🧩"];
const COLOR_CHOICES = ["#007acc", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#34495e"];
const BUILD_TARGETS = ["", "StandaloneOSX", "StandaloneWindows64", "StandaloneLinux64", "Android", "iOS", "WebGL", "tvOS"];
const ARCHS = ["", "arm64", "x86_64"];

interface GitInfo { isGit: boolean; branch?: string; repoUrl?: string; dirty?: boolean }

export function Projects() {
  const { t } = useI18n();
  const { projects, setProjects, setProjectsLoading, setProjectsError, editors } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [cloneVcs, setCloneVcs] = useState("github");
  const [cloneNs, setCloneNs] = useState("");
  const [cloneRepo, setCloneRepo] = useState("");
  const [cloneRef, setCloneRef] = useState("");
  const [cloning, setCloning] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeVersion, setUpgradeVersion] = useState("");
  const [creating, setCreating] = useState(false);
  const [metaMap, setMetaMap] = useState<Record<string, ProjectMeta>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);
  const [editMeta, setEditMeta] = useState<ProjectMeta>({});
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [projectSizes, setProjectSizes] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [gitInfoMap, setGitInfoMap] = useState<Record<string, GitInfo>>({});
  const [inlineVersionPath, setInlineVersionPath] = useState<string | null>(null);
  const [inlineTargetPath, setInlineTargetPath] = useState<string | null>(null);
  const { menu, open: openContextMenu, close: closeContextMenu } = useContextMenu();

  const [createName, setCreateName] = useState("");
  const [createPath, setCreatePath] = useState("");
  const [createVersion, setCreateVersion] = useState("");
  const [createTemplate, setCreateTemplate] = useState("");

  const showToast = useToastStore(s => s.addToast);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const data = await tauri.listProjects();
      setProjects(data);
      const metaPromises = data.map(p => tauri.getProjectMeta(p.path).catch(() => ({} as ProjectMeta)));
      const metas = await Promise.all(metaPromises);
      setMetaMap(prev => { const map = { ...prev }; data.forEach((p, i) => { if (metas[i] && Object.keys(metas[i]).length > 0) map[p.path] = metas[i]; }); return map; });
      // Load git info for all projects
      const gitPromises = data.map(p => tauri.getGitInfo(p.path).catch(() => ({ isGit: false })));
      const gits = await Promise.all(gitPromises);
      const gMap: Record<string, GitInfo> = {};
      data.forEach((p, i) => { gMap[p.path] = gits[i]; });
      setGitInfoMap(gMap);
      // Load all project sizes at once
      try {
        const sizeResult = await tauri.projectSize(undefined, true);
        const sizes: Record<string, string> = {};
        if (sizeResult?.projects && Array.isArray(sizeResult.projects)) {
          sizeResult.projects.forEach((p: any) => {
            sizes[p.path] = formatBytes(p.bytes);
          });
        }
        setProjectSizes(sizes);
      } catch {}
    } catch (e: any) { setError(e.message); setProjectsError(e.message); }
    finally { setLoading(false); setProjectsLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const filteredProjects = searchQuery.trim()
    ? projects.filter(p => { const name = (metaMap[p.path]?.customName || p.title || "").toLowerCase(); const ver = (p.version || "").toLowerCase(); const path = (p.path || "").toLowerCase(); const q = searchQuery.toLowerCase(); return name.includes(q) || ver.includes(q) || path.includes(q); })
    : projects;

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let cmp = 0;
    if (sortField === "title") cmp = (metaMap[a.path]?.customName || a.title || "").localeCompare(metaMap[b.path]?.customName || b.title || "");
    else if (sortField === "version") cmp = (a.version || "").localeCompare(b.version || "");
    else if (sortField === "modified") cmp = (a.lastModified || 0) - (b.lastModified || 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => { if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortField(field); setSortDir("asc"); } };
  const toggleExpand = (path: string) => { setExpandedPaths(prev => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n; }); };

  const createCommand = createName ? `unity projects new ${createName}${createVersion ? ` --editor-version ${createVersion}` : ""}${createTemplate ? ` --template ${createTemplate}` : ""}${createPath ? ` --path ${createPath}` : ""} --json` : "unity projects new <name>";

  const handleBrowse = async () => { try { const s = await openDialog({ directory: true, multiple: false, title: t("projects.selectFolder") }); if (s) setCreatePath(s as string); } catch (e: any) { showToast("error", e.message); } };
  const handleAddExisting = async () => { try { const s = await openDialog({ directory: true, multiple: false, title: t("projects.selectExistingFolder") }); if (s) { await tauri.addExistingProject(s as string); showToast("success", t("projects.projectAdded")); loadData(); } } catch (e: any) { showToast("error", e.message); } };
  const handleCreate = async () => { setCreating(true); try { await tauri.createProject({ name: createName, path: createPath || undefined, editorVersion: createVersion || undefined, template: createTemplate || undefined }); showToast("success", `${t("projects.createdMsg")}: ${createName}`); setShowCreate(false); setCreateName(""); setCreatePath(""); setCreateVersion(""); setCreateTemplate(""); loadData(); } catch (e: any) { showToast("error", e.message); } finally { setCreating(false); } };
  const handleUpgrade = async () => { if (!selectedProject || !upgradeVersion) return; try { await tauri.upgradeProject(selectedProject.path, upgradeVersion); showToast("success", `${t("projects.upgradingMsg")}: ${upgradeVersion}`); setShowUpgrade(false); setUpgradeVersion(""); } catch (e: any) { showToast("error", e.message); } };
  const handleAction = async (fn: () => Promise<any>, successMsg: string) => { try { await fn(); showToast("success", successMsg); loadData(); } catch (e: any) { showToast("error", e.message); } };
  const handleReveal = async (proj: Project) => { try { await tauri.revealInFileManager(proj.path); } catch (e: any) { showToast("error", e.message); } };
  const handleOpenTerminal = async (proj: Project) => { try { await tauri.openTerminalAtPath(proj.path); showToast("success", t("projects.ctxOpenTerminal")); } catch (e: any) { showToast("error", e.message); } };
  const handleOpenEditor = async (proj: Project) => { try { await tauri.openInEditor(proj.path); } catch (e: any) { showToast("error", e.message); } };
  const handleCopyPath = (proj: Project) => { copyToClipboard(proj.path); showToast("success", t("common.copied")); };
  const handleOpenWithParams = async (proj: Project) => { const meta = metaMap[proj.path] || {}; try { await tauri.openProjectWithParams({ project: proj.path, editorVersion: meta.openEditorVersion || undefined, buildTarget: meta.openBuildTarget || undefined, architecture: meta.openArchitecture || undefined, extraArgs: meta.openExtraArgs || undefined }); showToast("success", t("projects.opening")); } catch (e: any) { showToast("error", e.message); } };
  const openSettings = (proj: Project) => { setSettingsProject(proj); setEditMeta(metaMap[proj.path] || {}); setShowSettings(true); };
  const handleSaveSettings = async () => { if (!settingsProject) return; try { await tauri.setProjectMeta(settingsProject.path, editMeta); setMetaMap(prev => ({ ...prev, [settingsProject.path]: editMeta })); showToast("success", t("projects.applied")); setShowSettings(false); } catch (e: any) { showToast("error", e.message); } };
  const handleInlineVersionChange = async (proj: Project, version: string) => { setInlineVersionPath(null); if (version) { try { await tauri.openProjectWithParams({ project: proj.path, editorVersion: version }); showToast("success", `${t("projects.inlineSwitchVersion")}: ${version}`); } catch (e: any) { showToast("error", e.message); } } };
  const handleInlineTargetChange = async (proj: Project, target: string) => { setInlineTargetPath(null); if (target) { const meta = metaMap[proj.path] || {}; const newMeta = { ...meta, openBuildTarget: target }; try { await tauri.setProjectMeta(proj.path, newMeta); setMetaMap(prev => ({ ...prev, [proj.path]: newMeta })); showToast("success", `${t("projects.inlineSwitchTarget")}: ${target}`); } catch (e: any) { showToast("error", e.message); } } };

  const getProjectName = (proj: Project) => metaMap[proj.path]?.customName || proj.title;
  const getProjectIcon = (proj: Project) => { const meta = metaMap[proj.path]; if (!meta?.iconType || !meta?.iconValue) return null; if (meta.iconType === "emoji") return <span className="text-lg leading-none">{meta.iconValue}</span>; if (meta.iconType === "color") return <div className="h-5 w-5 rounded-full" style={{ backgroundColor: meta.iconValue }} />; if (meta.iconType === "image") return <img src={meta.iconValue} alt="" className="h-5 w-5 rounded object-cover" />; return null; };

  const buildContextMenu = (proj: Project): ContextMenuItem[] => [
    { label: t("projects.ctxOpen"), icon: FolderOpen, onClick: () => handleAction(() => tauri.openProject(proj.path), t("projects.opening")) },
    { label: t("projects.ctxOpenWith"), icon: Settings2, onClick: () => handleOpenWithParams(proj) },
    { label: t("projects.ctxReveal"), icon: ExternalLink, onClick: () => handleReveal(proj) },
    { label: t("projects.ctxOpenTerminal"), icon: TerminalIcon, onClick: () => handleOpenTerminal(proj) },
    { label: t("projects.ctxOpenEditor"), icon: Code2, onClick: () => handleOpenEditor(proj) },
    { label: t("projects.ctxCopyPath"), icon: Copy, onClick: () => handleCopyPath(proj) },
    { separator: true },
    { label: t("projects.ctxSettings"), icon: Settings2, onClick: () => openSettings(proj) },
    { label: t("projects.ctxCheckEditor"), icon: HardDrive, onClick: () => handleAction(() => tauri.projectRequire(proj.path), t("projects.editorCheckComplete")) },
    { label: t("projects.ctxSize"), icon: HardDrive, onClick: async () => { try { const info = await tauri.projectSize(proj.path); const size = info?.data?.size || "—"; setProjectSizes(prev => ({ ...prev, [proj.path]: size })); showToast("success", `${t("projects.ctxSize")}: ${size}`); } catch (e: any) { showToast("error", e.message); } } },
    { separator: true },
    proj.isFavorite ? { label: t("projects.ctxUnpin"), icon: Star, onClick: () => handleAction(() => tauri.unpinProject(proj.path), t("projects.unpinned")) } : { label: t("projects.ctxPin"), icon: Star, onClick: () => handleAction(() => tauri.pinProject(proj.path), t("projects.pinned")) },
    { label: t("projects.ctxUpgrade"), icon: ArrowUpCircle, onClick: () => { setSelectedProject(proj); setShowUpgrade(true); } },
    { label: t("projects.ctxLink"), icon: Link2, onClick: () => handleAction(() => tauri.projectLink(proj.path, "cloud"), t("projects.linked")) },
    { label: t("projects.ctxUnlink"), icon: Unlink, onClick: () => handleAction(() => tauri.projectUnlink(proj.path, "cloud"), t("projects.unlinked")) },
    { separator: true },
    { label: t("projects.ctxRemove"), icon: Trash2, danger: true, onClick: () => handleAction(() => tauri.removeProject(proj.path), t("projects.removedFromHub")) },
  ];

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground" onClick={() => toggleSort(field)}>
      {label}{sortField === field && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t("projects.title")} description={t("projects.desc")}>
        <div className="relative"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t("search.placeholder")} className="h-8 w-48 pl-8" /></div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("common.refresh")}</Button>
        <Button variant="outline" size="sm" onClick={handleAddExisting}><FolderPlus className="mr-2 h-3.5 w-3.5" /> {t("projects.addExisting")}</Button>
        <Button variant="outline" size="sm" onClick={async () => {
          try {
            const filePath = await openDialog({ save: true, title: t("projects.export"), filters: [{ name: "JSON", extensions: ["json"] }] });
            if (filePath) {
              await tauri.projectsExport(filePath as string);
              showToast("success", `${t("projects.exported")}: ${filePath}`);
            }
          } catch (e: any) { showToast("error", e.message); }
        }}><Download className="mr-2 h-3.5 w-3.5" /> {t("projects.export")}</Button>
        <Button variant="outline" size="sm" onClick={async () => {
          try {
            const filePath = await openDialog({ title: t("projects.import"), filters: [{ name: "JSON", extensions: ["json"] }] });
            if (filePath) {
              await tauri.projectsImport(filePath as string);
              showToast("success", t("projects.imported"));
              loadData();
            }
          } catch (e: any) { showToast("error", e.message); }
        }}><Upload className="mr-2 h-3.5 w-3.5" /> {t("projects.import")}</Button>
        <Button variant="outline" size="sm" onClick={() => setShowClone(!showClone)}><GitPullRequest className="mr-2 h-3.5 w-3.5" /> {t("projects.clone")}</Button>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}><Plus className="mr-2 h-3.5 w-3.5" /> {t("projects.createProject")}</Button>
      </PageHeader>

      {error && <ErrorState message={error} />}

      {/* Sort + count bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">{sortedProjects.length} {t("nav.projects").toLowerCase()}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("projects.sortByName").replace("Sort by ", "")}:</span>
          <Select value={sortField} onChange={e => { setSortField(e.target.value as SortField); setSortDir("asc"); }} className="h-7 w-28 text-xs">
            <option value="title">{t("projects.title2")}</option>
            <option value="version">{t("projects.version")}</option>
            <option value="modified">{t("projects.modified")}</option>
          </Select>
          <button className="text-muted-foreground hover:text-foreground" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
            {sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner className="h-6 w-6" /> : sortedProjects.length === 0 ? <EmptyState message={t("projects.noProjects")} /> : (
        <div className="space-y-2">
          {sortedProjects.map(proj => {
            const isExpanded = expandedPaths.has(proj.path);
            const gitInfo = gitInfoMap[proj.path];
            const meta = metaMap[proj.path] || {};
            return (
              <Card key={proj.path} className={cn("overflow-hidden transition-all", isExpanded && "border-primary/50")}>
                {/* Main row */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/30"
                  onClick={() => toggleExpand(proj.path)}
                  onContextMenu={(e) => openContextMenu(e, buildContextMenu(proj))}
                >
                  {/* Expand button */}
                  <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); toggleExpand(proj.path); }}>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {/* Icon */}
                  <div className="w-6 text-center shrink-0">{getProjectIcon(proj)}</div>

                  {/* Name + favorite */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{getProjectName(proj)}</span>
                      {proj.isFavorite && <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />}
                      {meta.notes && <Info className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    </div>
                    {/* Git info inline */}
                    {gitInfo?.isGit && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] h-4 gap-0.5"><GitBranch className="h-2.5 w-2.5" />{gitInfo.branch}</Badge>
                        {gitInfo.dirty ? <Badge variant="warning" className="text-[10px] h-4">{t("projects.gitDirty")}</Badge> : <Badge variant="success" className="text-[10px] h-4">{t("projects.gitClean")}</Badge>}
                      </div>
                    )}
                  </div>

                  {/* Inline version selector */}
                  <div className="shrink-0" onClick={e => e.stopPropagation()}>
                    {inlineVersionPath === proj.path ? (
                      <Select value={proj.version} onChange={e => handleInlineVersionChange(proj, e.target.value)} onBlur={() => setInlineVersionPath(null)} className="h-7 w-32 text-xs" autoFocus>
                        <option value="">{t("projects.defaultParams")}</option>
                        {editors.map(ed => <option key={ed.version} value={ed.version}>{ed.version}</option>)}
                      </Select>
                    ) : (
                      <button className="rounded px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setInlineVersionPath(proj.path)} title={t("projects.inlineSwitchVersion")}>
                        {proj.version}
                      </button>
                    )}
                  </div>

                  {/* Inline target selector */}
                  <div className="shrink-0" onClick={e => e.stopPropagation()}>
                    {inlineTargetPath === proj.path ? (
                      <Select value={meta.openBuildTarget || proj.buildTarget || ""} onChange={e => handleInlineTargetChange(proj, e.target.value)} onBlur={() => setInlineTargetPath(null)} className="h-7 w-36 text-xs" autoFocus>
                        {BUILD_TARGETS.map(bt => <option key={bt} value={bt}>{bt || t("projects.defaultParams")}</option>)}
                      </Select>
                    ) : (
                      <button className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setInlineTargetPath(proj.path)} title={t("projects.inlineSwitchTarget")}>
                        {meta.openBuildTarget || proj.buildTarget || "—"}
                      </button>
                    )}
                  </div>

                  {/* Pipeline */}
                  {proj.renderPipeline && <Badge variant="outline" className="shrink-0 text-[10px]">{proj.renderPipeline}</Badge>}

                  {/* Cloud */}
                  {proj.cloudEnabled && <Cloud className="h-3.5 w-3.5 shrink-0 text-blue-400" />}

                  {/* Size */}
                  {projectSizes[proj.path] && (
                    <span className="shrink-0 text-xs text-muted-foreground hidden lg:inline" title={t("projects.ctxSize")}>
                      <HardDrive className="mr-1 inline h-3 w-3" />{projectSizes[proj.path]}
                    </span>
                  )}

                  {/* Modified */}
                  <span className="shrink-0 text-xs text-muted-foreground hidden lg:inline">{formatDate(proj.lastModified)}</span>

                  {/* Action buttons */}
                  <div className="flex shrink-0 gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title={t("projects.ctxOpen")} onClick={() => handleAction(() => tauri.openProject(proj.path), t("projects.opening"))}><FolderOpen className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title={t("projects.ctxOpenWith")} onClick={() => handleOpenWithParams(proj)}><Settings2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title={t("projects.projectSettings")} onClick={() => openSettings(proj)}><Settings2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openContextMenu(e.nativeEvent, buildContextMenu(proj)); }}><MoreVertical className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><span className="text-muted-foreground">{t("editors.path")}:</span> <code className="text-xs break-all">{proj.path}</code></div>
                      <div><span className="text-muted-foreground">{t("editors.arch")}:</span> {proj.architecture}</div>
                      <div><span className="text-muted-foreground">{t("projects.modified")}:</span> {formatDate(proj.lastModified)}</div>
                      {projectSizes[proj.path] && <div><span className="text-muted-foreground">{t("projects.ctxSize")}:</span> {projectSizes[proj.path]}</div>}
                      {proj.changeset && <div><span className="text-muted-foreground">Changeset:</span> <code className="text-xs">{proj.changeset}</code></div>}
                    </div>
                    {/* Git detail */}
                    {gitInfo?.isGit && (
                      <div className="rounded-md border border-border p-3 space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium"><GitCommit className="h-4 w-4" /> {t("projects.gitStatus")}</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-muted-foreground">{t("projects.gitBranch")}:</span> {gitInfo.branch || "—"}</div>
                          <div><span className="text-muted-foreground">{t("projects.gitRepo")}:</span> <code className="text-xs break-all">{gitInfo.repoUrl || "—"}</code></div>
                          <div><span className="text-muted-foreground">{t("projects.gitStatus")}:</span> {gitInfo.dirty ? t("projects.gitDirty") : t("projects.gitClean")}</div>
                        </div>
                      </div>
                    )}
                    {meta.notes && <div className="rounded-md border border-border p-2 text-sm"><span className="text-muted-foreground">{t("projects.notes")}:</span> {meta.notes}</div>}
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleAction(() => tauri.openProject(proj.path), t("projects.opening"))}><FolderOpen className="mr-1 h-3.5 w-3.5" /> {t("projects.ctxOpen")}</Button>
                      <Button size="sm" variant="outline" onClick={() => handleOpenWithParams(proj)}><Settings2 className="mr-1 h-3.5 w-3.5" /> {t("projects.ctxOpenWith")}</Button>
                      <Button size="sm" variant="outline" onClick={() => handleReveal(proj)}><ExternalLink className="mr-1 h-3.5 w-3.5" /> {t("projects.ctxReveal")}</Button>
                      <Button size="sm" variant="outline" onClick={() => handleOpenTerminal(proj)}><TerminalIcon className="mr-1 h-3.5 w-3.5" /> {t("projects.ctxOpenTerminal")}</Button>
                      <Button size="sm" variant="outline" onClick={() => handleOpenEditor(proj)}><Code2 className="mr-1 h-3.5 w-3.5" /> {t("projects.ctxOpenEditor")}</Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction(() => tauri.projectRequire(proj.path), t("projects.editorCheckComplete"))}><HardDrive className="mr-1 h-3.5 w-3.5" /> {t("projects.ctxCheckEditor")}</Button>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedProject(proj); setShowUpgrade(true); }}><ArrowUpCircle className="mr-1 h-3.5 w-3.5" /> {t("projects.ctxUpgrade")}</Button>
                      <Button size="sm" variant="outline" onClick={() => openSettings(proj)}><Settings2 className="mr-1 h-3.5 w-3.5" /> {t("projects.projectSettings")}</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {menu && <ContextMenu items={menu.items} x={menu.x} y={menu.y} onClose={closeContextMenu} />}

      {/* Project settings dialog */}
      {showSettings && settingsProject && (
        <Card className="border-primary/50">
          <CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2">{getProjectIcon(settingsProject)}{t("projects.projectSettings")} — {getProjectName(settingsProject)}</span><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettings(false)}>✕</Button></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>{t("projects.customName")}</Label><Input value={editMeta.customName || ""} onChange={e => setEditMeta({ ...editMeta, customName: e.target.value || undefined })} placeholder={t("projects.customNamePlaceholder")} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("projects.iconType")}</Label><Select value={editMeta.iconType || ""} onChange={e => setEditMeta({ ...editMeta, iconType: (e.target.value || undefined) as ProjectMeta["iconType"], iconValue: "" })} className="mt-1"><option value="">{t("projects.defaultParams")}</option><option value="emoji">{t("projects.iconEmoji")}</option><option value="color">{t("projects.iconColor")}</option><option value="image">{t("projects.iconImage")}</option></Select></div>
              <div><Label>{t("projects.iconValue")}</Label><div className="mt-1">{editMeta.iconType === "emoji" && <div className="flex flex-wrap gap-1">{EMOJI_CHOICES.map(em => <button key={em} onClick={() => setEditMeta({ ...editMeta, iconValue: em })} className={cn("flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-accent", editMeta.iconValue === em && "ring-2 ring-primary")}>{em}</button>)}</div>}{editMeta.iconType === "color" && <div className="flex flex-wrap gap-2">{COLOR_CHOICES.map(c => <button key={c} onClick={() => setEditMeta({ ...editMeta, iconValue: c })} className={cn("h-8 w-8 rounded-full", editMeta.iconValue === c && "ring-2 ring-primary ring-offset-2 ring-offset-background")} style={{ backgroundColor: c }} />)}</div>}{editMeta.iconType === "image" && <Input value={editMeta.iconValue || ""} onChange={e => setEditMeta({ ...editMeta, iconValue: e.target.value })} placeholder="/path/to/icon.png" />}</div></div>
            </div>
            <div><Label>{t("projects.notes")}</Label><Textarea value={editMeta.notes || ""} onChange={e => setEditMeta({ ...editMeta, notes: e.target.value || undefined })} placeholder={t("projects.notesPlaceholder")} className="mt-1" /></div>
            <div className="rounded-md border border-border p-3"><p className="mb-2 text-sm font-medium">{t("projects.openParams")}</p><p className="mb-3 text-xs text-muted-foreground">{t("projects.openParamsDesc")}</p><div className="grid grid-cols-2 gap-3"><div><Label>{t("projects.editorVersion")}</Label><Select value={editMeta.openEditorVersion || ""} onChange={e => setEditMeta({ ...editMeta, openEditorVersion: e.target.value || undefined })} className="mt-1"><option value="">{t("projects.defaultParams")}</option>{editors.map(ed => <option key={ed.version} value={ed.version}>{ed.version}</option>)}</Select></div><div><Label>{t("projects.buildTarget")}</Label><Select value={editMeta.openBuildTarget || ""} onChange={e => setEditMeta({ ...editMeta, openBuildTarget: e.target.value || undefined })} className="mt-1">{BUILD_TARGETS.map(bt => <option key={bt} value={bt}>{bt || t("projects.defaultParams")}</option>)}</Select></div></div></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowSettings(false)}>{t("common.cancel")}</Button><Button onClick={handleSaveSettings}>{t("common.save")}</Button></div>
          </CardContent>
        </Card>
      )}

      {/* Create project dialog */}
      {showCreate && (
        <Card className="border-primary/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> {t("projects.createProject")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("projects.projectName")}</Label><Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="MyGame" className="mt-1" /></div>
              <div><Label>{t("projects.parentDir")}</Label><div className="mt-1 flex gap-1"><Input value={createPath} onChange={e => setCreatePath(e.target.value)} placeholder="~/UnityProjects" className="flex-1" /><Button variant="outline" size="icon" onClick={handleBrowse}><FolderOpen className="h-4 w-4" /></Button></div></div>
              <div><Label>{t("projects.editorVersion")}</Label><Select value={createVersion} onChange={e => setCreateVersion(e.target.value)} className="mt-1"><option value="">{t("projects.defaultParams")}</option><option value="lts">Latest LTS</option><option value="latest">Latest</option>{editors.map(ed => <option key={ed.version} value={ed.version}>{ed.version}</option>)}</Select></div>
              <div><Label>{t("projects.template")}</Label><Select value={createTemplate} onChange={e => setCreateTemplate(e.target.value)} className="mt-1"><option value="">{t("projects.defaultParams")}</option><option value="com.unity.template.3d">3D</option><option value="com.unity.template.2d">2D</option><option value="com.unity.template.urp">URP</option><option value="com.unity.template.hdrp">HDRP</option></Select></div>
            </div>
            <CommandPreview command={createCommand} />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button><Button disabled={!createName || creating} onClick={handleCreate}>{creating ? t("projects.creating") : t("common.create")}</Button></div>
          </CardContent>
        </Card>
      )}

      {/* Clone project dialog */}
      {showClone && (
        <Card className="border-primary/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><GitPullRequest className="h-4 w-4" /> {t("projects.clone")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("projects.cloneVcs")}</Label><Select value={cloneVcs} onChange={e => setCloneVcs(e.target.value)} className="mt-1"><option value="github">GitHub</option><option value="gitlab">GitLab</option><option value="uvcs">UVCS</option></Select></div>
              <div><Label>{t("projects.cloneNamespace")}</Label><Input value={cloneNs} onChange={e => setCloneNs(e.target.value)} placeholder="my-org" className="mt-1" /></div>
              <div><Label>{t("projects.cloneRepo")}</Label><Input value={cloneRepo} onChange={e => setCloneRepo(e.target.value)} placeholder="MyGame" className="mt-1" /></div>
              <div><Label>{t("projects.cloneRef")}</Label><Input value={cloneRef} onChange={e => setCloneRef(e.target.value)} placeholder="main" className="mt-1" /></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowClone(false)}>{t("common.cancel")}</Button><Button disabled={!cloneNs || !cloneRepo || cloning} onClick={async () => { setCloning(true); try { await tauri.projectClone({ vcs: cloneVcs, vcsNamespace: cloneNs, vcsRepo: cloneRepo, refName: cloneRef || undefined }); showToast("success", t("projects.cloneSuccess")); setShowClone(false); setCloneNs(""); setCloneRepo(""); setCloneRef(""); loadData(); } catch (e: any) { showToast("error", e.message); } finally { setCloning(false); } }}>{cloning ? t("projects.cloning") : t("projects.clone")}</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
