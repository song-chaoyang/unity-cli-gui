import { create } from "zustand";

type Theme = "dark" | "light" | "system";

interface ThemeState {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
  initTheme: () => void;
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "dark",
  resolvedTheme: "dark",

  setTheme: (theme: Theme) => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });
    try {
      localStorage.setItem("unity-gui-theme", theme);
    } catch {}
  },

  initTheme: () => {
    try {
      const saved = localStorage.getItem("unity-gui-theme") as Theme | null;
      const theme = saved || "dark";
      const resolved = theme === "system" ? getSystemTheme() : theme;
      applyTheme(resolved);
      set({ theme, resolvedTheme: resolved });
    } catch {
      applyTheme("dark");
    }

    // Listen for system theme changes
    if (typeof window !== "undefined" && window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (get().theme === "system") {
          const resolved = e.matches ? "dark" : "light";
          applyTheme(resolved);
          set({ resolvedTheme: resolved });
        }
      });
    }
  },
}));
