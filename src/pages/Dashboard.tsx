import { useEffect, useState } from "react";
import { Gamepad2, FolderOpen, Activity, HardDrive, LogIn, Zap, Package, Bot, Clock, ArrowRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared";
import { useAppStore } from "@/stores/useAppStore";
import { useI18n } from "@/i18n";
import * as tauri from "@/lib/tauri";
import { cn, formatDate } from "@/lib/utils";

const RECENT_KEY = "unity-gui-recent-projects";

function loadRecentProjects(): string[] {
  try {
    const s = localStorage.getItem(RECENT_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

function saveRecentProject(path: string) {
  try {
    const recent = loadRecentProjects().filter(p => p !== path);
    recent.unshift(path);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 6)));
  } catch {}
}

export function Dashboard() {
  const { t } = useI18n();
  const {
    editors, setEditors, setEditorsLoading, setEditorsError,
    projects, setProjects, setProjectsLoading, setProjectsError,
    editorStatuses, setStatuses,
    authInfo, setAuthInfo,
    cacheInfo, setCacheInfo,
    setPage,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [recentPaths, setRecentPaths] = useState<string[]>(loadRecentProjects());

  useEffect(() => {
    (async () => {
      setLoading(true);
      setEditorsLoading(true);
      setProjectsLoading(true);
      try {
        const [eds, projs, statuses, auth, cache] = await Promise.allSettled([
          tauri.listEditors(), tauri.listProjects(), tauri.getStatus(), tauri.authStatus(), tauri.cacheInfo(),
        ]);
        if (eds.status === "fulfilled") setEditors(eds.value);
        else setEditorsError(eds.reason?.message || "Failed to load editors");
        if (projs.status === "fulfilled") setProjects(projs.value);
        else setProjectsError(projs.reason?.message || "Failed to load projects");
        if (statuses.status === "fulfilled") setStatuses(statuses.value);
        if (auth.status === "fulfilled") {
          const a = auth.value;
          if (a?.loggedIn) {
            setAuthInfo({ loggedIn: true, name: a.user?.name, email: a.user?.email });
          }
        } else {
          // Auth check failed on Dashboard load — retry once
          try {
            const retry = await tauri.authStatus();
            if (retry?.loggedIn) {
              setAuthInfo({ loggedIn: true, name: retry.user?.name, email: retry.user?.email });
            }
          } catch {}
        }
        if (cache.status === "fulfilled") setCacheInfo(cache.value);
      } finally {
        setLoading(false);
        setEditorsLoading(false);
        setProjectsLoading(false);
      }
    })();
  }, []);

  // Refresh recent projects from store
  useEffect(() => {
    setRecentPaths(loadRecentProjects());
  }, [projects]);

  const runningCount = editorStatuses.length;

  const recentProjects = recentPaths
    .map(path => projects.find(p => p.path === path))
    .filter(Boolean) as typeof projects;

  const handleOpenRecent = (path: string) => {
    saveRecentProject(path);
    tauri.openProject(path).catch(() => {});
    setPage("projects");
  };

  const handleQuickOpen = (path: string) => {
    saveRecentProject(path);
    handleOpenRecent(path);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("dash.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dash.desc")}</p>
      </div>

      {loading && <LoadingSpinner className="h-6 w-6" />}

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setPage("editors")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs">{t("dash.installedEditors")}</CardTitle>
            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{editors.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">{editors.filter(e => e.default).length > 0 ? `Default: ${editors.find(e => e.default)?.version}` : "No default set"}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setPage("projects")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs">{t("nav.projects")}</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">{projects.filter(p => p.isFavorite).length} pinned</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setPage("mcp")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs">{t("dash.runningEditors")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningCount}</div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <span className={cn("h-1.5 w-1.5 rounded-full", runningCount > 0 ? "bg-green-400 animate-pulse" : "bg-muted-foreground")} />
              {runningCount > 0 ? "Active" : "Idle"}
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setPage("settings")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs">{t("dash.cacheSize")}</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheInfo?.size || "—"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{cacheInfo?.fileCount || 0} files</div>
          </CardContent>
        </Card>
      </div>

      {/* Running Editors — clickable to open project */}
      {runningCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-green-400" /> {t("dash.runningEditors")}
              <Badge variant="success">{runningCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {editorStatuses.map((st, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/30"
                  onClick={() => {
                    const projPath = st.projectPath || st.project;
                    if (projPath) {
                      saveRecentProject(projPath);
                      tauri.openProject(projPath).catch(() => {});
                      setPage("projects");
                    }
                  }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-green-500/10 shrink-0">
                    <Activity className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{st.version || "Unity Editor"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{st.projectPath || st.project || "—"}</span>
                      <span>· PID: {st.pid || "—"}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" /> {t("projects.recentProjects")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("projects.noRecent")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {recentProjects.map(proj => (
                <div
                  key={proj.path}
                  className="group flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/30"
                  onClick={() => handleQuickOpen(proj.path)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 shrink-0">
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{proj.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{proj.version}</span>
                      {proj.buildTarget && <span>· {proj.buildTarget}</span>}
                      <span>· {formatDate(proj.lastModified)}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auth + Quick Actions side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Auth status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("dash.auth")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogIn className="h-5 w-5 text-muted-foreground" />
              <div>
                {authInfo?.loggedIn ? (
                  <>
                    <p className="text-sm font-medium">{authInfo.name || t("dash.connected")}</p>
                    <p className="text-xs text-muted-foreground">{authInfo.email}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("dash.notLoggedIn")}</p>
                )}
              </div>
            </div>
            <Badge variant={authInfo?.loggedIn ? "success" : "destructive"}>
              {authInfo?.loggedIn ? t("dash.connected") : t("dash.offline")}
            </Badge>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("dash.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-2">
            <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setPage("editors")}>
              <Package className="h-4 w-4" />
              <span className="text-[10px]">{t("dash.installEditor")}</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setPage("projects")}>
              <FolderOpen className="h-4 w-4" />
              <span className="text-[10px]">{t("dash.createProject")}</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setPage("build")}>
              <Zap className="h-4 w-4" />
              <span className="text-[10px]">{t("dash.buildProject")}</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setPage("aichat")}>
              <Bot className="h-4 w-4" />
              <span className="text-[10px]">{t("nav.aichat")}</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
