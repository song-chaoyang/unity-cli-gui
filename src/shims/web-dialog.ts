/**
 * Web shim for @tauri-apps/plugin-dialog
 *
 * Uses a server-side file browser modal (FileBrowserModal) instead of prompt().
 * The browser fetches real directory listings from the Node.js server via
 * the list_directory invoke command.
 *
 * In non-web builds (Tauri, uTools), this shim is not used — native/utools
 * dialogs are used instead.
 */

import { useFileBrowserStore } from "@/stores/useFileBrowserStore";

export interface OpenDialogOptions {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  save?: boolean;
}

export async function open(options?: OpenDialogOptions): Promise<string | string[] | null> {
  return useFileBrowserStore.getState().openBrowser(options || {});
}

export interface ConfirmDialogOptions {
  title?: string;
  message?: string;
  type?: "info" | "warning" | "error" | "question";
}

export async function confirm(options?: ConfirmDialogOptions): Promise<boolean> {
  return window.confirm(options?.message || "");
}
