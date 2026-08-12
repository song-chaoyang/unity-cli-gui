import { create } from "zustand";
import type { Editor, Project, EditorStatus, CacheInfo, EnvInfo } from "@/lib/tauri";
import * as tauri from "@/lib/tauri";

interface AppState {
  // Navigation
  currentPage: string;
  setPage: (page: string) => void;

  // Unity CLI availability
  unityAvailable: boolean;
  unityPath: string | null;
  setUnityAvailable: (available: boolean, path: string | null) => void;
  recheckUnityAvailable: () => Promise<void>;

  // Editors
  editors: Editor[];
  editorsLoading: boolean;
  editorsError: string | null;
  setEditors: (editors: Editor[]) => void;
  setEditorsLoading: (loading: boolean) => void;
  setEditorsError: (error: string | null) => void;

  // Projects
  projects: Project[];
  projectsLoading: boolean;
  projectsError: string | null;
  setProjects: (projects: Project[]) => void;
  setProjectsLoading: (loading: boolean) => void;
  setProjectsError: (error: string | null) => void;

  // Status
  editorStatuses: EditorStatus[];
  setStatuses: (statuses: EditorStatus[]) => void;

  // Cache
  cacheInfo: CacheInfo | null;
  setCacheInfo: (info: CacheInfo | null) => void;

  // Env
  envInfo: EnvInfo | null;
  setEnvInfo: (info: EnvInfo | null) => void;

  // Auth
  authInfo: { loggedIn: boolean; name?: string; email?: string } | null;
  setAuthInfo: (info: { loggedIn: boolean; name?: string; email?: string } | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: "dashboard",
  setPage: (page) => set({ currentPage: page }),

  unityAvailable: false,
  unityPath: null,
  setUnityAvailable: (available, path) => set({ unityAvailable: available, unityPath: path }),
  recheckUnityAvailable: async () => {
    try {
      const available = await tauri.checkUnityAvailable();
      const path = available ? await tauri.getUnityPath() : null;
      set({ unityAvailable: available, unityPath: path });
    } catch {
      set({ unityAvailable: false, unityPath: null });
    }
  },

  editors: [],
  editorsLoading: false,
  editorsError: null,
  setEditors: (editors) => set({ editors }),
  setEditorsLoading: (loading) => set({ editorsLoading: loading }),
  setEditorsError: (error) => set({ editorsError: error }),

  projects: [],
  projectsLoading: false,
  projectsError: null,
  setProjects: (projects) => set({ projects }),
  setProjectsLoading: (loading) => set({ projectsLoading: loading }),
  setProjectsError: (error) => set({ projectsError: error }),

  editorStatuses: [],
  setStatuses: (statuses) => set({ editorStatuses: statuses }),

  cacheInfo: null,
  setCacheInfo: (info) => set({ cacheInfo: info }),

  envInfo: null,
  setEnvInfo: (info) => set({ envInfo: info }),

  authInfo: null,
  setAuthInfo: (info) => set({ authInfo: info }),
}));
