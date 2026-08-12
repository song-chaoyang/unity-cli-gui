/**
 * Shim for @tauri-apps/plugin-dialog
 * Maps Tauri's open() to uTools' showOpenDialog / showSaveDialog.
 */

export interface OpenDialogOptions {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  save?: boolean;
}

/**
 * open() mirrors @tauri-apps/plugin-dialog's open().
 * - save: true  → utools.showSaveDialog → returns string | null
 * - directory: true → utools.showOpenDialog with openDirectory → returns string | null
 * - default (file open) → utools.showOpenDialog with openFile → returns string | null
 * - multiple: true → returns string[] | null
 */
export async function open(options?: OpenDialogOptions): Promise<string | string[] | null> {
  const utools = (window as any).utools;
  if (!utools) {
    // Fallback for non-uTools environments (e.g. plain browser dev)
    console.warn("utools not available — dialog ignored");
    return null;
  }

  // uTools filter format: [{ name: 'JSON', extensions: ['json'] }]
  const filters = options?.filters?.map((f) => ({
    name: f.name,
    extensions: f.extensions,
  }));

  if (options?.save) {
    const result = await utools.showSaveDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      filters,
    });
    return result || null;
  }

  const properties: string[] = [];
  if (options?.directory) {
    properties.push("openDirectory");
  } else {
    properties.push("openFile");
  }
  if (options?.multiple) {
    properties.push("multiSelections");
  }

  const result = await utools.showOpenDialog({
    title: options?.title,
    defaultPath: options?.defaultPath,
    filters,
    properties,
  });

  if (!result || result.length === 0) return null;
  if (options?.multiple) return result as string[];
  return result[0] as string;
}

export interface ConfirmDialogOptions {
  title?: string;
  message?: string;
  type?: "info" | "warning" | "error" | "question";
}

export async function confirm(options?: ConfirmDialogOptions): Promise<boolean> {
  const utools = (window as any).utools;
  if (!utools) return false;
  return utools.showMessageBox({
    type: options?.type || "question",
    title: options?.title || "",
    message: options?.message || "",
    buttons: ["Cancel", "OK"],
  }) === 1;
}
