import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  isDir: boolean;
  size: number;
}

interface FileBrowserOptions {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
  save?: boolean;
  defaultPath?: string;
}

interface FileBrowserState {
  isOpen: boolean;
  mode: "open" | "save" | "directory";
  title: string;
  currentPath: string;
  entries: DirEntry[];
  selectedPath: string | null;
  fileName: string;
  loading: boolean;
  error: string | null;
  resolve: ((value: string | string[] | null) => void) | null;

  openBrowser: (options: FileBrowserOptions) => Promise<string | string[] | null>;
  closeBrowser: (result: string | null) => void;
  navigateTo: (dirPath: string) => Promise<void>;
  goUp: () => Promise<void>;
  selectEntry: (entry: DirEntry) => void;
  setFileName: (name: string) => void;
  confirm: () => void;
  createDirectory: (name: string) => Promise<void>;
  deleteEntry: (entry: DirEntry) => Promise<void>;
  renameEntry: (entry: DirEntry, newName: string) => Promise<void>;
}

export const useFileBrowserStore = create<FileBrowserState>((set, get) => ({
  isOpen: false,
  mode: "open",
  title: "Browse",
  currentPath: "/",
  entries: [],
  selectedPath: null,
  fileName: "",
  loading: false,
  error: null,
  resolve: null,

  openBrowser: (options) => {
    // Close any existing browser
    if (get().isOpen) {
      get().closeBrowser(null);
    }

    const mode: "open" | "save" | "directory" = options.save ? "save" : options.directory ? "directory" : "open";

    const promise = new Promise<string | string[] | null>((resolve) => {
      set({
        isOpen: true,
        mode,
        title: options.title || (mode === "save" ? "Save File" : mode === "directory" ? "Select Directory" : "Open File"),
        currentPath: options.defaultPath || "/",
        entries: [],
        selectedPath: null,
        fileName: "",
        loading: false,
        error: null,
        resolve,
      });

      // Navigate to the starting path
      get().navigateTo(options.defaultPath || "/");
    });

    return promise;
  },

  closeBrowser: (result) => {
    const { resolve } = get();
    if (resolve) resolve(result);
    set({ isOpen: false, resolve: null, entries: [], selectedPath: null, error: null });
  },

  navigateTo: async (dirPath) => {
    set({ loading: true, error: null, selectedPath: null });
    try {
      const result = await invoke<{ path: string; entries: DirEntry[] }>("list_directory", { path: dirPath });
      set({ currentPath: result.path, entries: result.entries, loading: false });
    } catch (err: any) {
      // Fallback: try to get home dir
      try {
        const home = await invoke<string>("get_home_dir");
        const result = await invoke<{ path: string; entries: DirEntry[] }>("list_directory", { path: home });
        set({ currentPath: result.path, entries: result.entries, loading: false });
      } catch {
        set({ loading: false, error: err.message || "Failed to list directory" });
      }
    }
  },

  goUp: async () => {
    const { currentPath } = get();
    const parent = currentPath.replace(/\/[^/]+\/?$/, "") || "/";
    if (parent !== currentPath) {
      await get().navigateTo(parent);
    }
  },

  selectEntry: (entry) => {
    const { currentPath, mode } = get();
    const fullPath = currentPath.endsWith("/") ? `${currentPath}${entry.name}` : `${currentPath}/${entry.name}`;
    if (mode === "directory" && entry.isDir) {
      set({ selectedPath: fullPath });
    } else if (mode === "open" && !entry.isDir) {
      set({ selectedPath: fullPath });
    } else if (mode === "save" && !entry.isDir) {
      set({ selectedPath: fullPath, fileName: entry.name });
    } else if (entry.isDir) {
      // Double-click a dir to navigate into it
      get().navigateTo(fullPath);
    }
  },

  setFileName: (name) => {
    const { currentPath } = get();
    const fullPath = currentPath.endsWith("/") ? `${currentPath}${name}` : `${currentPath}/${name}`;
    set({ fileName: name, selectedPath: fullPath });
  },

  confirm: () => {
    const { mode, selectedPath, fileName, currentPath, resolve } = get();
    if (!resolve) return;

    let result: string | null = null;
    if (mode === "save") {
      // For save mode, construct path from current dir + filename
      if (fileName.trim()) {
        result = currentPath.endsWith("/") ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
      }
    } else {
      result = selectedPath;
    }

    resolve(result);
    set({ isOpen: false, resolve: null, entries: [], selectedPath: null });
  },

  createDirectory: async (name) => {
    const { currentPath } = get();
    const fullPath = currentPath.endsWith("/") ? `${currentPath}${name}` : `${currentPath}/${name}`;
    try {
      await invoke("create_directory", { path: fullPath });
      await get().navigateTo(currentPath);
    } catch (err: any) {
      set({ error: err.message || "Failed to create directory" });
    }
  },

  deleteEntry: async (entry) => {
    const { currentPath } = get();
    const fullPath = currentPath.endsWith("/") ? `${currentPath}${entry.name}` : `${currentPath}/${entry.name}`;
    try {
      await invoke("delete_path", { path: fullPath });
      await get().navigateTo(currentPath);
    } catch (err: any) {
      set({ error: err.message || "Failed to delete" });
    }
  },

  renameEntry: async (entry, newName) => {
    const { currentPath } = get();
    const fromPath = currentPath.endsWith("/") ? `${currentPath}${entry.name}` : `${currentPath}/${entry.name}`;
    const toPath = currentPath.endsWith("/") ? `${currentPath}${newName}` : `${currentPath}/${newName}`;
    try {
      await invoke("rename_path", { from: fromPath, to: toPath });
      await get().navigateTo(currentPath);
    } catch (err: any) {
      set({ error: err.message || "Failed to rename" });
    }
  },
}));
