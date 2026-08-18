import { useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon, Plus, X, Maximize2, Minimize2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared";
import { CommandPreview } from "@/components/CommandPreview";
import { useI18n } from "@/i18n";
import * as tauri from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface TabState {
  id: number;
  title: string;
  output: string[];
  history: string[];
  historyIndex: number;
  running: boolean;
}

let nextTabId = 1;

export function TerminalPage() {
  const { t } = useI18n();
  const [tabs, setTabs] = useState<TabState[]>([
    { id: nextTabId, title: `Terminal 1`, output: [
      `${t("terminal.title")} — ${t("terminal.desc")}`,
      t("terminal.placeholder"),
      "",
    ], history: [], historyIndex: -1, running: false },
  ]);
  const [activeTabId, setActiveTabId] = useState(nextTabId);
  const [jsonMode, setJsonMode] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [activeTab?.output]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeTabId]);

  const updateTab = (id: number, updater: (tab: TabState) => TabState) => {
    setTabs(prev => prev.map(tab => tab.id === id ? updater(tab) : tab));
  };

  const appendOutput = (id: number, lines: string[]) => {
    updateTab(id, tab => ({ ...tab, output: [...tab.output, ...lines] }));
  };

  const handleCommand = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const cmd = e.currentTarget.value.trim();
      if (!cmd || !activeTab) return;

      appendOutput(activeTab.id, [`❯ ${cmd}`]);
      const newHistory = [...activeTab.history, cmd];

      const args = cmd.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/^"|"$/g, "")) || [];

      updateTab(activeTab.id, tab => ({ ...tab, history: newHistory, historyIndex: newHistory.length, running: true }));
      e.currentTarget.value = "";

      try {
        const result = await tauri.runUnityCommand(args, jsonMode);
        const lines = result.split("\n").filter(l => l.length > 0);
        appendOutput(activeTab.id, lines.length > 0 ? lines : [`(${t("terminal.noOutput")})`]);
      } catch (err: any) {
        appendOutput(activeTab.id, [`${t("common.error")}: ${err.message || err}`]);
      } finally {
        updateTab(activeTab.id, tab => ({ ...tab, running: false }));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!activeTab || activeTab.history.length === 0) return;
      const newIndex = Math.max(0, activeTab.historyIndex - 1);
      const cmd = activeTab.history[newIndex] || "";
      e.currentTarget.value = cmd;
      updateTab(activeTab.id, tab => ({ ...tab, historyIndex: newIndex }));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!activeTab) return;
      const newIndex = Math.min(activeTab.history.length, activeTab.historyIndex + 1);
      const cmd = activeTab.history[newIndex] || "";
      e.currentTarget.value = cmd;
      updateTab(activeTab.id, tab => ({ ...tab, historyIndex: newIndex }));
    }
  };

  const addTab = () => {
    nextTabId++;
    const newTab: TabState = {
      id: nextTabId,
      title: `Terminal ${tabs.length + 1}`,
      output: [`${t("terminal.title")} — ${t("terminal.ready")}`, ""],
      history: [],
      historyIndex: -1,
      running: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(nextTabId);
  };

  const closeTab = (id: number) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(tab => tab.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[0].id);
  };

  return (
    <div className={cn("space-y-4", maximized && "fixed inset-0 z-50 overflow-hidden bg-background p-4")}>
      {maximized && (
        <div className="flex items-center justify-between">
          <PageHeader title={t("terminal.title")} description={t("terminal.desc")} />
          <Button variant="outline" size="sm" onClick={() => setMaximized(false)}>
            <Minimize2 className="mr-2 h-3.5 w-3.5" /> {t("terminal.minimize")}
          </Button>
        </div>
      )}
      {!maximized && (
        <PageHeader title={t("terminal.title")} description={t("terminal.desc")} />
      )}

      {/* Session context */}
      {!maximized && (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("terminal.sessionContext")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("terminal.outputFormat")}</Label>
            <Select value={jsonMode ? "json" : "human"} onChange={(e) => setJsonMode(e.target.value === "json")} className="mt-1">
              <option value="human">{t("terminal.human")}</option>
              <option value="json">JSON (--json)</option>
            </Select>
          </div>
          <div className="flex items-end">
            <CommandPreview command={`unity ${jsonMode ? "--json --no-banner " : ""}<command>`} />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Terminal */}
      <Card className={cn("overflow-hidden", maximized && "flex h-full flex-col")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TerminalIcon className="h-4 w-4" /> {t("terminal.shell")}
            </CardTitle>
            <div className="flex items-center gap-1">
              {tabs.map(tab => (
                <div key={tab.id} className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs cursor-pointer ${activeTabId === tab.id ? "bg-secondary" : "hover:bg-accent"}`}
                  onClick={() => setActiveTabId(tab.id)}>
                    {tab.title}
                    {tab.running && <span className="ml-1 h-2 w-2 animate-spin rounded-full border border-primary border-t-transparent" />}
                    {tabs.length > 1 && (
                      <X className="ml-1 h-3 w-3 hover:text-destructive" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} />
                    )}
                  </div>
              ))}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addTab}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMaximized(!maximized)} title={maximized ? t("terminal.minimize") : t("terminal.maximize")}>
                {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(maximized && "flex flex-1 flex-col overflow-hidden")}>
          <div ref={containerRef} className={cn(
            "overflow-auto rounded-md bg-black/60 p-3 font-mono text-xs",
            maximized ? "flex-1" : "h-96"
          )}>
            {activeTab?.output.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap ${line.startsWith("❯") ? "text-primary" : line.startsWith(t("common.error")) ? "text-red-400" : "text-muted-foreground"}`}>
                {line || "\u00A0"}
              </div>
            ))}
            {activeTab?.running && (
              <div className="text-yellow-400">⏳ {t("terminal.executing")}</div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-primary">❯</span>
            <input
              ref={inputRef}
              type="text"
              onKeyDown={handleCommand}
              placeholder={t("terminal.placeholder")}
              className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
              spellCheck={false}
              autoComplete="off"
            />
            <Badge variant="outline" className="text-xs">
              {jsonMode ? "JSON" : t("terminal.human")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {!maximized && (
        <p className="text-xs text-muted-foreground">
          {t("terminal.help")}
        </p>
      )}
    </div>
  );
}
