import { useEffect, useState, useRef } from "react";
import {
  Folder, File, ChevronRight, ArrowUp, Home, Check, X,
  FolderPlus, Trash2, Pencil, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFileBrowserStore, type DirEntry } from "@/stores/useFileBrowserStore";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface ContextMenu {
  x: number;
  y: number;
  entry: DirEntry | null; // null = background right-click
}

export function FileBrowserModal() {
  const { t } = useI18n();
  const {
    isOpen, mode, title, currentPath, entries, selectedPath,
    fileName, loading, error,
    closeBrowser, navigateTo, goUp, selectEntry, setFileName, confirm,
    createDirectory, deleteEntry, renameEntry,
  } = useFileBrowserStore();

  const [ctxMenu, setCtxMenu] = useState<ContextMenu | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renaming, setRenaming] = useState<DirEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (ctxMenu) { setCtxMenu(null); return; }
        if (showNewFolder) { setShowNewFolder(false); return; }
        if (renaming) { setRenaming(null); return; }
        closeBrowser(null);
      }
      if (e.key === "Enter" && !ctxMenu && !showNewFolder && !renaming && (selectedPath || fileName)) confirm();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, selectedPath, fileName, ctxMenu, showNewFolder, renaming]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxMenu]);

  useEffect(() => {
    if (showNewFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [showNewFolder]);

  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  if (!isOpen) return null;

  const pathSegments = currentPath.split("/").filter(Boolean);
  const canConfirm = mode === "save" ? fileName.trim().length > 0 : selectedPath !== null;

  const fullPath = (name: string) =>
    currentPath.endsWith("/") ? `${currentPath}${name}` : `${currentPath}/${name}`;

  const handleContextMenu = (e: React.MouseEvent, entry: DirEntry | null) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleNewFolder = async () => {
    if (newFolderName.trim()) {
      await createDirectory(newFolderName.trim());
    }
    setShowNewFolder(false);
    setNewFolderName("");
  };

  const handleRename = async () => {
    if (renaming && renameValue.trim()) {
      await renameEntry(renaming, renameValue.trim());
    }
    setRenaming(null);
    setRenameValue("");
  };

  const handleDelete = async (entry: DirEntry) => {
    setCtxMenu(null);
    if (window.confirm(t("fileBrowser.confirmDelete", { name: entry.name }))) {
      await deleteEntry(entry);
    }
  };

  // Clamp context menu position to viewport
  const ctxStyle = ctxMenu ? {
    left: Math.min(ctxMenu.x, window.innerWidth - 180),
    top: Math.min(ctxMenu.y, window.innerHeight - 200),
  } : {};

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={() => closeBrowser(null)}
      onContextMenu={(e) => { e.preventDefault(); handleContextMenu(e, null); }}
    >
      <div
        className="flex max-h-[80vh] w-[min(640px,90vw)] flex-col rounded-lg border border-border bg-popover shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowNewFolder(true); }} title={t("fileBrowser.newFolder")}>
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => closeBrowser(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Breadcrumb / path bar */}
        <div className="flex items-center gap-1 border-b border-border px-2 py-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateTo("/")} title={t("fileBrowser.root")}>
            <Home className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goUp} title={t("fileBrowser.up")}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <div className="flex flex-1 items-center gap-0.5 overflow-x-auto text-xs">
            <button className="rounded px-1 py-0.5 hover:bg-accent" onClick={() => navigateTo("/")}>/</button>
            {pathSegments.map((seg, i) => {
              const segPath = "/" + pathSegments.slice(0, i + 1).join("/");
              return (
                <div key={i} className="flex items-center gap-0.5">
                  <button className="rounded px-1 py-0.5 hover:bg-accent" onClick={() => navigateTo(segPath)}>{seg}</button>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </div>

        {/* File list */}
        <div
          className="flex-1 overflow-auto"
          style={{ minHeight: "200px", maxHeight: "400px" }}
          onContextMenu={(e) => { e.preventDefault(); handleContextMenu(e, null); }}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-red-400">{error}</div>
          ) : entries.length === 0 && !showNewFolder ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("fileBrowser.empty")}</div>
          ) : (
            <div className="py-1">
              {showNewFolder && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/5">
                  <FolderPlus className="h-4 w-4 text-blue-400" />
                  <input
                    ref={newFolderInputRef}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleNewFolder();
                      if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
                    }}
                    onBlur={() => { if (!newFolderName.trim()) { setShowNewFolder(false); setNewFolderName(""); } }}
                    placeholder={t("fileBrowser.folderNamePlaceholder")}
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              )}
              {entries.map((entry) => {
                const fp = fullPath(entry.name);
                const isSelected = selectedPath === fp;
                const isRenaming = renaming?.name === entry.name;
                return (
                  <div
                    key={entry.name}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-default",
                      isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                    onClick={() => {
                      if (entry.isDir) {
                        if (mode === "directory") selectEntry(entry);
                        else navigateTo(fp);
                      } else {
                        selectEntry(entry);
                      }
                    }}
                    onDoubleClick={() => { if (entry.isDir) navigateTo(fp); }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); handleContextMenu(e, entry); }}
                  >
                    {entry.isDir ? (
                      <Folder className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary-foreground" : "text-blue-400")} />
                    ) : (
                      <File className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                    )}
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename();
                          if (e.key === "Escape") { setRenaming(null); setRenameValue(""); }
                        }}
                        onBlur={() => { if (!renameValue.trim()) { setRenaming(null); setRenameValue(""); } }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-background px-1 text-sm outline-none ring-1 ring-primary rounded"
                      />
                    ) : (
                      <span className="flex-1 truncate text-left">{entry.name}</span>
                    )}
                    {!entry.isDir && !isRenaming && (
                      <span className={cn("text-xs shrink-0", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {entry.size > 1024 * 1024 ? `${(entry.size / 1024 / 1024).toFixed(1)} MB` : entry.size > 1024 ? `${(entry.size / 1024).toFixed(0)} KB` : `${entry.size} B`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          {mode === "save" && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("fileBrowser.file")}</span>
              <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="filename.json" className="h-8 flex-1"
                onKeyDown={(e) => { if (e.key === "Enter" && fileName.trim()) confirm(); }} />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 truncate text-xs text-muted-foreground">
              {selectedPath || (mode === "save" ? `${currentPath}/${fileName}` : "—")}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => closeBrowser(null)}>{t("fileBrowser.cancel")}</Button>
              <Button size="sm" disabled={!canConfirm} onClick={confirm}>
                <Check className="mr-1 h-3.5 w-3.5" /> {mode === "save" ? t("fileBrowser.save") : t("fileBrowser.select")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          className="fixed z-[101] min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-lg"
          style={ctxStyle}
        >
          {ctxMenu.entry ? (
            <>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                onClick={() => { setRenaming(ctxMenu.entry!); setRenameValue(ctxMenu.entry!.name); setCtxMenu(null); }}
              >
                <Pencil className="h-3.5 w-3.5" /> {t("fileBrowser.rename")}
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-accent"
                onClick={() => handleDelete(ctxMenu.entry!)}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("fileBrowser.delete")}
              </button>
            </>
          ) : (
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => { setShowNewFolder(true); setCtxMenu(null); }}
            >
              <FolderPlus className="h-3.5 w-3.5" /> {t("fileBrowser.newFolder")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
