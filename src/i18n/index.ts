import { create } from "zustand";
import { translations, resolveLang, type Lang } from "./translations";

interface I18nState {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLang: (lang: Lang) => void;
  initFromSystem: () => void;
  initFromCLI: (cliLang: string) => void;
}

/// Detect the system locale from the browser / Tauri environment.
function detectSystemLocale(): string {
  if (typeof navigator !== "undefined") {
    return navigator.language || navigator.languages?.[0] || "en";
  }
  return "en";
}

/// Get the initial language synchronously — localStorage > navigator > "en"
function getInitialLang(): Lang {
  // 1. Check localStorage (user's saved preference)
  try {
    const saved = localStorage.getItem("unity-gui-lang");
    if (saved && saved in translations) {
      return saved as Lang;
    }
  } catch {}

  // 2. Check system locale synchronously
  const locale = detectSystemLocale();
  return resolveLang(locale);
}

export const useI18n = create<I18nState>((set, get) => ({
  // Initialize synchronously to prevent English flash on startup
  lang: getInitialLang(),

  t: (key: string, params?: Record<string, string | number>) => {
    const lang = get().lang;
    const dict = translations[lang] || translations.en;
    let str = dict[key] ?? translations.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  },

  setLang: (lang: Lang) => {
    set({ lang });
    try {
      localStorage.setItem("unity-gui-lang", lang);
    } catch {}
  },

  initFromSystem: () => {
    try {
      const saved = localStorage.getItem("unity-gui-lang");
      if (saved && saved in translations) {
        set({ lang: saved as Lang });
        return;
      }
    } catch {}
    const locale = detectSystemLocale();
    set({ lang: resolveLang(locale) });
  },

  initFromCLI: (cliLang: string) => {
    // localStorage takes priority (user's explicit choice)
    try {
      const saved = localStorage.getItem("unity-gui-lang");
      if (saved && saved in translations) {
        set({ lang: saved as Lang });
        return;
      }
    } catch {}

    // If CLI has a non-English language, use it
    if (cliLang && cliLang !== "en") {
      set({ lang: resolveLang(cliLang) });
    }
    // Otherwise the synchronous initial value from getInitialLang() is already correct
  },
}));
