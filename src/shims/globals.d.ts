/**
 * Global type declarations for uTools environment.
 * Declares the utools global and window.unityAPI bridge.
 */

// uTools global API (subset used by shims)
declare const utools: {
  showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
    properties?: string[];
  }): Promise<string[] | null>;

  showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | null>;

  showMessageBox(options: {
    type?: string;
    title?: string;
    message?: string;
    buttons?: string[];
  }): number;

  shellOpenPath(path: string): void;
  showItemInFolder(path: string): void;
  shellOpenExternal(url: string): void;

  onPluginEnter?(callback: (action: { code: string; type: string; payload: any }) => void): void;
  onPluginOut?(callback: () => void): void;
  isDarkColors?(): boolean;
  setExpendHeight?(height: number): void;
  copyText?(text: string): void;
  db?: any;
  getPath?(key: string): string;
};

// Bridge exposed by preload.js (window.unityAPI)
interface UnityAPI {
  invoke(cmd: string, args?: Record<string, unknown>): Promise<any>;
  listen(
    eventName: string,
    handler: (event: { payload: any }) => void
  ): Promise<() => void>;
  emit?(eventName: string, payload?: any): void;
}

interface Window {
  unityAPI: UnityAPI;
  utools: typeof utools;
}
