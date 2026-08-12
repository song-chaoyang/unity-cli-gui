import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard, Gamepad2, FolderOpen, Hammer,
  FlaskConical, Bot, Sparkles, Terminal as TerminalIcon, ScrollText, Settings as SettingsIcon, Info, Download,
  Circle, ChevronDown, User, LogOut, LogIn, Package,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { useToastStore } from "@/stores/useToastStore";
import { useI18n } from "@/i18n";
import { useTheme } from "@/stores/useTheme";
import * as tauri from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { Dashboard } from "@/pages/Dashboard";
import { Editors } from "@/pages/Editors";
import { Projects } from "@/pages/Projects";
import { Build } from "@/pages/Build";
import { Test } from "@/pages/Test";
import { McpAi } from "@/pages/McpAi";
import { AiChat } from "@/pages/AiChat";
import { TerminalPage } from "@/pages/Terminal";
import { Logs } from "@/pages/Logs";
import { Settings } from "@/pages/Settings";
import { About } from "@/pages/About";
import { Downloads } from "@/pages/Downloads";
import { ToastOverlay } from "@/components/ToastOverlay";

// All page components — kept mounted, hidden when inactive to prevent re-fetch
const PAGES: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  editors: Editors,
  projects: Projects,
  build: Build,
  test: Test,
  mcp: McpAi,
  aichat: AiChat,
  downloads: Downloads,
  terminal: TerminalPage,
  logs: Logs,
  settings: Settings,
  about: About,
};

function App() {
  const {
    currentPage, setPage,
    unityAvailable, setUnityAvailable, unityPath,
    editors, projects, editorStatuses,
    authInfo, setAuthInfo,
  } = useAppStore();

  const { t, initFromCLI } = useI18n();
  const { initTheme } = useTheme();
  const showToast = useToastStore(s => s.addToast);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Initialize theme, language + check Unity CLI availability + auth status on startup
  useEffect(() => {
    initTheme();
    (async () => {
      try {
        const lang = await tauri.getLanguage();
        initFromCLI(lang?.current || "");
      } catch {
        initFromCLI("");
      }
      try {
        const available = await tauri.checkUnityAvailable();
        const path = available ? await tauri.getUnityPath() : null;
        setUnityAvailable(available, path);
      } catch {
        setUnityAvailable(false, null);
      }
      // Check auth status on startup (with retry)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const status = await tauri.authStatus();
          if (status) {
            setAuthInfo({
              loggedIn: status.loggedIn ?? false,
              name: status.user?.name,
              email: status.user?.email,
            });
            break; // Success, no retry needed
          }
        } catch (e) {
          console.error(`Auth status check attempt ${attempt + 1} failed:`, e);
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        }
      }
    })();
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cmd+, (macOS) or Ctrl+, shortcut to Settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setPage("settings");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setPage]);

  const NAV_ITEMS = [
    { id: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { id: "editors", label: t("nav.editors"), icon: Gamepad2 },
    { id: "projects", label: t("nav.projects"), icon: FolderOpen },
    { id: "build", label: t("nav.build"), icon: Hammer },
    { id: "test", label: t("nav.test"), icon: FlaskConical },
    { id: "mcp", label: t("nav.mcp"), icon: Bot },
    { id: "aichat", label: t("nav.aichat"), icon: Sparkles },
    { id: "downloads", label: t("nav.downloads"), icon: Download },
    { id: "terminal", label: t("nav.terminal"), icon: TerminalIcon },
    { id: "logs", label: t("nav.logs"), icon: ScrollText },
    { id: "settings", label: t("nav.settings"), icon: SettingsIcon },
    { id: "about", label: t("nav.about"), icon: Info },
  ];

  const handleLogin = async () => {
    setShowUserMenu(false);
    try {
      // authLogin launches browser + polls auth status until login completes or times out
      const status = await tauri.authLogin();
      if (status) {
        const s = status as any;
        setAuthInfo({
          loggedIn: s.loggedIn ?? false,
          name: s.user?.name,
          email: s.user?.email,
        });
      }
    } catch (e: any) {
      console.error("Login failed:", e);
      showToast("error", e.message || "Login failed");
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      await tauri.authLogout();
      setAuthInfo({ loggedIn: false });
    } catch (e: any) {
      // Even if logout command fails, update UI state
      setAuthInfo({ loggedIn: false });
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <ToastOverlay />
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          {/* Real app icon */}
          <img src="/icon.png" alt="Unity CLI GUI" className="h-7 w-7 rounded" onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }} />
          <span className="text-sm font-semibold">Unity CLI GUI</span>
          <span className="text-xs text-muted-foreground">v0.0.1</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {unityAvailable ? (
            <button
              onClick={() => setPage("settings")}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-accent"
              title={unityPath || ""}
            >
              <Circle className="h-2 w-2 fill-green-400 text-green-400" />
              <span className="text-green-400">CLI ✓</span>
            </button>
          ) : (
            <button
              onClick={() => setPage("settings")}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-3 w-3" />
              <span>{t("settings.installCli")}</span>
            </button>
          )}
          {/* User menu with interaction */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-accent"
            >
              <Circle className={cn("h-2 w-2", authInfo?.loggedIn ? "fill-green-400 text-green-400" : "fill-red-400 text-red-400")} />
              <span>{authInfo?.loggedIn ? authInfo.name : t("status.notLoggedIn")}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-lg">
                {authInfo?.loggedIn ? (
                  <>
                    <div className="px-2 py-1.5 border-b border-border">
                      <p className="text-sm font-medium">{authInfo.name}</p>
                      <p className="text-xs text-muted-foreground">{authInfo.email}</p>
                    </div>
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent">
                      <LogOut className="h-3.5 w-3.5" /> {t("settings.logout")}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-2 py-1.5 border-b border-border">
                      <p className="text-xs text-muted-foreground">{t("dash.notLoggedIn")}</p>
                    </div>
                    <button onClick={handleLogin} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent">
                      <LogIn className="h-3.5 w-3.5" /> {t("settings.login")}
                    </button>
                  </>
                )}
                <div className="my-1 h-px bg-border" />
                <button onClick={() => { setShowUserMenu(false); setPage("settings"); }} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent">
                  <SettingsIcon className="h-3.5 w-3.5" /> {t("nav.settings")}
                </button>
                <button onClick={() => { setShowUserMenu(false); setPage("about"); }} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent">
                  <Info className="h-3.5 w-3.5" /> {t("nav.about")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="flex w-16 flex-col items-center gap-1 border-r border-border py-2 lg:w-56">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2 text-sm font-medium transition-colors",
                  currentPage === item.id
                    ? "border-l-2 border-primary bg-accent text-accent-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Page content — all pages kept mounted, hidden when inactive */}
        <main className="flex-1 overflow-hidden">
          {Object.entries(PAGES).map(([pageId, PageComp]) => (
            <div
              key={pageId}
              className={cn("h-full overflow-auto p-4", currentPage === pageId ? "block" : "hidden")}
            >
              <PageComp />
            </div>
          ))}
        </main>
      </div>

      {/* Status bar */}
      <footer className="flex h-7 items-center justify-between border-t border-border px-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>CLI v1.0.0-beta.3</span>
          {authInfo?.loggedIn ? (
            <span className="flex items-center gap-1">
              <Circle className="h-2 w-2 fill-green-400 text-green-400" />
              {authInfo.name}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Circle className="h-2 w-2 fill-red-400 text-red-400" />
              {t("status.notLoggedIn")}
            </span>
          )}
          <span>{editors.length} {t("status.editorsInstalled")}</span>
          <span>{projects.length} {t("nav.projects").toLowerCase()}</span>
          {editorStatuses.length > 0 && (
            <span className="text-green-400">{editorStatuses.length} {t("status.running")}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unityAvailable ? (
            <span className="text-green-400">● {t("status.cliConnected")}</span>
          ) : (
            <span className="text-red-400">● {t("status.cliNotFound")}</span>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;
