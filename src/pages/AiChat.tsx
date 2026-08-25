import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Trash2, Settings as SettingsIcon, Terminal, Check, Loader2, Bot, User, Plus, X, Copy, RefreshCw, ChevronDown, ChevronRight, Server, Zap, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CommandPreview } from "@/components/CommandPreview";
import { useI18n } from "@/i18n";
import * as tauri from "@/lib/tauri";
import { cn, copyToClipboard } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
  commands?: string[];
  results?: string[];
  thinking?: boolean;
  timestamp?: number;
}

interface ModelConfig {
  name: string;
  baseUrl: string;
  provider: "anthropic" | "openai" | "google" | "custom";
  apiKey?: string;
}

interface McpService {
  id: string;
  name: string;
  url: string;
  command: string;
  args: string;
  enabled: boolean;
}

interface SkillConfig {
  id: string;
  name: string;
  prompt: string;
  enabled: boolean;
}

interface AiSettings {
  apiKey: string;
  activeModel: string;
  models: ModelConfig[];
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  streaming: boolean;
  contextWindow: number;
  mcpServices: McpService[];
  skills: SkillConfig[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "unity-gui-ai-settings-v2";

const DEFAULT_SYSTEM_PROMPT = `You are a Unity CLI assistant. The user controls Unity through the unity command-line tool.

When the user asks you to do something, respond with a JSON block containing the commands to execute:
\`\`\`json
{"commands": ["unity editors --json --no-banner", "unity projects list --json --no-banner"]}
\`\`\`

Available unity commands include: editors, projects list, projects create, projects new, install, uninstall, build, test, status, releases, modules, open, run, mcp configure, pipeline list, logs, doctor, env, auth status, cache info, etc.

Keep responses concise. Always include the JSON command block when an action is needed. Explain briefly what each command does.`;

const PRESET_MODELS: ModelConfig[] = [
  { name: "claude-sonnet-4-5", baseUrl: "https://api.anthropic.com", provider: "anthropic" },
  { name: "claude-sonnet-4-6", baseUrl: "https://api.anthropic.com", provider: "anthropic" },
  { name: "claude-opus-4-8", baseUrl: "https://api.anthropic.com", provider: "anthropic" },
  { name: "claude-haiku-4-5", baseUrl: "https://api.anthropic.com", provider: "anthropic" },
  { name: "gpt-5.5", baseUrl: "https://api.openai.com", provider: "openai" },
  { name: "gpt-5.6-luna", baseUrl: "https://api.openai.com", provider: "openai" },
  { name: "gemini-3.5-flash", baseUrl: "https://generativelanguage.googleapis.com", provider: "google" },
  { name: "deepseek-v4-pro", baseUrl: "https://api.deepseek.com", provider: "custom" },
  { name: "qwen-3.7-max", baseUrl: "https://dashscope.aliyuncs.com", provider: "custom" },
];

const DEFAULT_SETTINGS: AiSettings = {
  apiKey: "",
  activeModel: "claude-sonnet-4-5",
  models: PRESET_MODELS,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  maxTokens: 4096,
  streaming: true,
  contextWindow: 20,
  mcpServices: [],
  skills: [],
};

// ─── Storage helpers ─────────────────────────────────────────────────────────

function loadSettings(): AiSettings {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      // Merge with defaults to ensure new fields exist
      return { ...DEFAULT_SETTINGS, ...parsed, models: parsed.models?.length ? parsed.models : PRESET_MODELS };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(s: AiSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

// ─── Component ───────────────────────────────────────────────────────────────

type SettingsTab = "general" | "models" | "mcp" | "skills";

export function AiChat() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: t("aichat.welcome"), timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const [expandedMsgs, setExpandedMsgs] = useState<Set<number>>(new Set());
  const [mcpSubTab, setMcpSubTab] = useState<"form" | "json" | "file">("form");
  const [mcpJsonText, setMcpJsonText] = useState("");
  const [mcpJsonError, setMcpJsonError] = useState<string | null>(null);
  const [mcpClients, setMcpClients] = useState<any[]>([]);
  const [editingFilePath, setEditingFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [fileSaved, setFileSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-save settings whenever they change
  const updateSettings = useCallback((newSettings: AiSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 1500);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Get the active model config
  const activeModelConfig = settings.models.find(m => m.name === settings.activeModel) || settings.models[0] || PRESET_MODELS[0];
  const activeBaseUrl = activeModelConfig?.baseUrl || settings.models[0]?.baseUrl || "https://api.anthropic.com";

  // Load MCP client list when switching to file tab
  const loadMcpClients = async () => {
    try {
      const clients = await tauri.listMcpClients();
      setMcpClients(clients || []);
    } catch { setMcpClients([]); }
  };

  const handleReadFile = async (path: string) => {
    setEditingFilePath(path);
    try {
      const content = await tauri.readFileContent(path);
      setFileContent(content);
    } catch {
      setFileContent("");
    }
  };

  const handleSaveFile = async () => {
    if (!editingFilePath) return;
    try {
      await tauri.writeFileContent(editingFilePath, fileContent);
      setFileSaved(true);
      setTimeout(() => setFileSaved(false), 2000);
    } catch (e: any) {
      setFileContent(prev => prev + "\n\n// Error: " + e.message);
    }
  };

  const handleMcpJsonImport = () => {
    try {
      const parsed = JSON.parse(mcpJsonText);
      const servers = parsed.mcpServers || parsed;
      const newServices: McpService[] = [];
      Object.entries(servers).forEach(([name, config]: [string, any]) => {
        newServices.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          name,
          url: config.url || "",
          command: config.command || "",
          args: Array.isArray(config.args) ? config.args.join(" ") : (config.args || ""),
          enabled: true,
        });
      });
      updateSettings({ ...settings, mcpServices: [...settings.mcpServices, ...newServices] });
      setMcpJsonError(null);
      setMcpJsonText("");
      setMcpSubTab("form");
    } catch (e: any) {
      setMcpJsonError(t("aichat.mcpJsonParseError") + ": " + e.message);
    }
  };

  const addMcpViaChat = () => {
    setShowSettings(false);
    setInput(t("aichat.mcpAddViaChatPrompt"));
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addSkillViaChat = () => {
    setShowSettings(false);
    setInput(t("aichat.skillAddViaChatPrompt"));
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await tauri.aiTestConnection(activeBaseUrl, settings.apiKey, settings.activeModel);
      setTestResult("✅ " + t("aichat.connectionOk") + " — " + result.slice(0, 100));
    } catch (e: any) {
      setTestResult("❌ " + t("aichat.connectionFailed") + ": " + e.message);
    } finally {
      setTesting(false);
    }
  };

  const parseCommands = (text: string): string[] => {
    const commands: string[] = [];
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (parsed.commands && Array.isArray(parsed.commands)) {
          commands.push(...parsed.commands);
        }
      } catch {}
    }
    const bashMatches = text.matchAll(/```(?:bash|shell|sh)?\s*(unity\s+[\s\S]*?)```/g);
    for (const m of bashMatches) {
      const lines = m[1].trim().split("\n").filter(l => l.trim().startsWith("unity"));
      commands.push(...lines.map(l => l.trim()));
    }
    return commands;
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    if (!settings.apiKey) {
      setShowSettings(true);
      setSettingsTab("general");
      return;
    }

    const userMsg: ChatMsg = { role: "user", content: input.trim(), timestamp: Date.now() };
    const thinkingMsg: ChatMsg = { role: "assistant", content: "", thinking: true, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setInput("");
    setSending(true);

    try {
      // Build context with system prompt + skills
      const skillPrompts = settings.skills.filter(s => s.enabled).map(s => s.prompt).join("\n\n");
      const fullSystemPrompt = settings.systemPrompt + (skillPrompts ? "\n\n" + skillPrompts : "");

      // Get recent messages within context window
      const recentMsgs = messages.filter(m => !m.thinking).slice(-settings.contextWindow);

      const chatMessages = [
        { role: "system", content: fullSystemPrompt },
        ...recentMsgs.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: userMsg.content },
      ];

      const response = await tauri.aiChat({
        gatewayUrl: activeBaseUrl,
        apiKey: settings.apiKey,
        model: settings.activeModel,
        messages: chatMessages,
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
      });

      const commands = parseCommands(response);
      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: response,
        commands: commands.length > 0 ? commands : undefined,
        timestamp: Date.now(),
      };

      // Auto-execute commands
      if (commands.length > 0) {
        assistantMsg.results = [];
        for (const cmd of commands) {
          try {
            // Strip "unity" prefix and --json/--no-banner flags (runUnityCommand adds them in json mode)
            let args = cmd.split(/\s+/).slice(1).filter(a => a !== "--json" && a !== "--no-banner");
            const hasJsonFlags = cmd.includes("--json");
            const result = await tauri.runUnityCommand(args, hasJsonFlags);
            const truncated = result.length > 2000 ? result.slice(0, 2000) + "..." : result;
            assistantMsg.results!.push(truncated);
          } catch (e: any) {
            assistantMsg.results!.push("Error: " + e.message);
          }
        }
      }

      setMessages(prev => [...prev.slice(0, -1), assistantMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev.slice(0, -1), {
        role: "assistant",
        content: "❌ " + t("common.error") + ": " + e.message,
        timestamp: Date.now(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", content: t("aichat.welcome"), timestamp: Date.now() }]);
  };

  const toggleExpand = (index: number) => {
    setExpandedMsgs(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // ─── Model management ─────────────────────────────────────────────────────

  const addCustomModel = () => {
    const newModel: ModelConfig = {
      name: "custom-model",
      baseUrl: "https://api.openai.com",
      provider: "custom",
    };
    updateSettings({ ...settings, models: [...settings.models, newModel] });
  };

  const removeModel = (name: string) => {
    if (settings.models.length <= 1) return;
    const newModels = settings.models.filter(m => m.name !== name);
    const newActive = settings.activeModel === name ? newModels[0].name : settings.activeModel;
    updateSettings({ ...settings, models: newModels, activeModel: newActive });
  };

  const updateModel = (oldName: string, field: keyof ModelConfig, value: string) => {
    const newModels = settings.models.map(m =>
      m.name === oldName ? { ...m, [field]: value } : m
    );
    const newActive = field === "name" ? value : settings.activeModel;
    updateSettings({ ...settings, models: newModels, activeModel: newActive });
  };

  // ─── MCP service management ───────────────────────────────────────────────

  const addMcpService = () => {
    const newService: McpService = {
      id: Date.now().toString(),
      name: "New MCP Service",
      url: "",
      command: "",
      args: "",
      enabled: true,
    };
    updateSettings({ ...settings, mcpServices: [...settings.mcpServices, newService] });
  };

  const updateMcpService = (id: string, field: keyof McpService, value: any) => {
    updateSettings({
      ...settings,
      mcpServices: settings.mcpServices.map(s => s.id === id ? { ...s, [field]: value } : s),
    });
  };

  const removeMcpService = (id: string) => {
    updateSettings({ ...settings, mcpServices: settings.mcpServices.filter(s => s.id !== id) });
  };

  // ─── Skill management ─────────────────────────────────────────────────────

  const addSkill = () => {
    const newSkill: SkillConfig = {
      id: Date.now().toString(),
      name: "New Skill",
      prompt: "",
      enabled: true,
    };
    updateSettings({ ...settings, skills: [...settings.skills, newSkill] });
  };

  const updateSkill = (id: string, field: keyof SkillConfig, value: any) => {
    updateSettings({
      ...settings,
      skills: settings.skills.map(s => s.id === id ? { ...s, [field]: value } : s),
    });
  };

  const removeSkill = (id: string) => {
    updateSettings({ ...settings, skills: settings.skills.filter(s => s.id !== id) });
  };

  const renderMessage = (msg: ChatMsg, index: number) => {
    if (msg.thinking) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("aichat.thinking")}
        </div>
      );
    }

    const textPart = msg.content.split("```")[0].trim();
    const hasCommands = msg.commands && msg.commands.length > 0;
    const hasResults = msg.results && msg.results.length > 0;
    const isExpanded = expandedMsgs.has(index);

    return (
      <>
        {textPart && <div className="whitespace-pre-wrap">{textPart}</div>}
        {hasCommands && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Terminal className="h-3 w-3" /> {t("aichat.executing")}
            </div>
            {msg.commands!.map((cmd, ci) => (
              <CommandPreview key={ci} command={cmd} />
            ))}
          </div>
        )}
        {hasResults && (
          <div className="mt-2 space-y-1">
            <button
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => toggleExpand(index)}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {t("aichat.result")} ({msg.results!.length})
            </button>
            {isExpanded && msg.results!.map((res, ri) => (
              <pre key={ri} className="max-h-40 overflow-auto rounded-md bg-black/40 p-2 text-xs text-green-400">
                {res}
              </pre>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex h-full flex-col space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("aichat.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("aichat.desc")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Active model indicator */}
          <Badge variant="secondary" className="hidden lg:inline-flex">
            {settings.activeModel}
          </Badge>
          <Button variant="outline" size="sm" onClick={clearChat}>
            <Trash2 className="mr-2 h-3.5 w-3.5" /> {t("aichat.clearChat")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <SettingsIcon className="mr-2 h-3.5 w-3.5" /> {t("aichat.settings")}
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <Card className="border-primary/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{t("aichat.settings")}</CardTitle>
              {autoSaved && <span className="text-xs text-green-400">{t("aichat.savedAuto")}</span>}
            </div>
            {/* Settings tabs */}
            <div className="flex gap-1 border-b border-border pt-2">
              {([
                { id: "general", label: t("aichat.settingsGeneral") },
                { id: "models", label: t("aichat.settingsModels") },
                { id: "mcp", label: t("aichat.settingsMcp") },
                { id: "skills", label: t("aichat.settingsSkills") },
              ] as { id: SettingsTab; label: string }[]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    settingsTab === tab.id
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* General tab */}
            {settingsTab === "general" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("aichat.activeModel")}</Label>
                    <Select
                      value={settings.activeModel}
                      onChange={e => updateSettings({ ...settings, activeModel: e.target.value })}
                      className="mt-1"
                    >
                      {settings.models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>{t("aichat.gateway")}</Label>
                    <Input
                      value={activeBaseUrl}
                      readOnly
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("aichat.apiKey")}</Label>
                  <Input
                    type="password"
                    value={settings.apiKey}
                    onChange={e => updateSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{t("aichat.systemPrompt")}</Label>
                  <Textarea
                    value={settings.systemPrompt}
                    onChange={e => updateSettings({ ...settings, systemPrompt: e.target.value })}
                    placeholder={t("aichat.systemPromptPlaceholder")}
                    className="mt-1 min-h-[80px] text-xs"
                  />
                </div>
                {/* Advanced parameters */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>{t("aichat.temperature")}: {settings.temperature.toFixed(1)}</Label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.temperature}
                      onChange={e => updateSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                      className="mt-2 w-full"
                    />
                  </div>
                  <div>
                    <Label>{t("aichat.maxTokens")}</Label>
                    <Input
                      type="number"
                      value={settings.maxTokens}
                      onChange={e => updateSettings({ ...settings, maxTokens: parseInt(e.target.value) || 4096 })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{t("aichat.contextWindow")}</Label>
                    <Input
                      type="number"
                      value={settings.contextWindow}
                      onChange={e => updateSettings({ ...settings, contextWindow: parseInt(e.target.value) || 20 })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.streaming}
                      onChange={e => updateSettings({ ...settings, streaming: e.target.checked })}
                    />
                    {t("aichat.streaming")}
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                    {testing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    {t("aichat.testConnection")}
                  </Button>
                </div>
                {testResult && (
                  <div className={cn("rounded-md p-2 text-xs", testResult.startsWith("✅") ? "text-green-400" : "text-destructive")}>
                    {testResult}
                  </div>
                )}
              </div>
            )}

            {/* Models tab */}
            {settingsTab === "models" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("aichat.models")} ({settings.models.length})</span>
                  <Button variant="outline" size="sm" onClick={addCustomModel}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> {t("aichat.addModel")}
                  </Button>
                </div>
                <div className="space-y-2">
                  {settings.models.map((model, i) => (
                    <div key={i} className="rounded-md border border-border p-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">{t("aichat.modelName")}</Label>
                          <Input
                            value={model.name}
                            onChange={e => updateModel(model.name, "name", e.target.value)}
                            className="mt-1 h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t("aichat.modelBaseUrl")}</Label>
                          <Input
                            value={model.baseUrl}
                            onChange={e => updateModel(model.name, "baseUrl", e.target.value)}
                            className="mt-1 h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t("aichat.modelProvider")}</Label>
                          <Select
                            value={model.provider}
                            onChange={e => updateModel(model.name, "provider", e.target.value)}
                            className="mt-1 h-8 text-xs"
                          >
                            <option value="anthropic">{t("aichat.provider.anthropic")}</option>
                            <option value="openai">{t("aichat.provider.openai")}</option>
                            <option value="google">{t("aichat.provider.google")}</option>
                            <option value="custom">{t("aichat.provider.custom")}</option>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {settings.activeModel === model.name && <Badge variant="success">{t("aichat.activeModel")}</Badge>}
                        <div className="flex gap-1 ml-auto">
                          {settings.activeModel !== model.name && (
                            <Button variant="ghost" size="sm" onClick={() => updateSettings({ ...settings, activeModel: model.name })}>
                              {t("common.open")}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => { if (confirm(t("aichat.confirmDeleteModel"))) removeModel(model.name); }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MCP Services tab */}
            {settingsTab === "mcp" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{t("aichat.mcpServices")}</span>
                    <p className="text-xs text-muted-foreground">{t("aichat.mcpDesc")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addMcpViaChat}>
                      <Sparkles className="mr-1 h-3.5 w-3.5" /> {t("aichat.mcpAddViaChat")}
                    </Button>
                  </div>
                </div>

                {/* Sub-tabs: Form / JSON / File */}
                <div className="flex gap-1 border-b border-border">
                  {([
                    { id: "form" as const, label: t("aichat.mcpForm") },
                    { id: "json" as const, label: t("aichat.mcpJson") },
                    { id: "file" as const, label: t("aichat.mcpFile") },
                  ]).map(sub => (
                    <button key={sub.id} onClick={() => {
                      setMcpSubTab(sub.id);
                      if (sub.id === "file") loadMcpClients();
                    }}
                      className={cn("px-3 py-1.5 text-xs font-medium transition-colors",
                        mcpSubTab === sub.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}>
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* Form mode */}
                {mcpSubTab === "form" && (
                  <div className="space-y-2">
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={addMcpService}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> {t("aichat.addMcp")}
                      </Button>
                    </div>
                    {settings.mcpServices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("aichat.noMcp")}</p>
                    ) : (
                      <div className="space-y-2">
                        {settings.mcpServices.map(svc => (
                          <div key={svc.id} className="rounded-md border border-border p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">{t("aichat.mcpName")}</Label>
                                <Input value={svc.name} onChange={e => updateMcpService(svc.id, "name", e.target.value)} className="mt-1 h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-xs">{t("aichat.mcpUrl")}</Label>
                                <Input value={svc.url} onChange={e => updateMcpService(svc.id, "url", e.target.value)} className="mt-1 h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-xs">{t("aichat.mcpCommand")}</Label>
                                <Input value={svc.command} onChange={e => updateMcpService(svc.id, "command", e.target.value)} className="mt-1 h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-xs">{t("aichat.mcpArgs")}</Label>
                                <Input value={svc.args} onChange={e => updateMcpService(svc.id, "args", e.target.value)} className="mt-1 h-8 text-xs" />
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={svc.enabled} onChange={e => updateMcpService(svc.id, "enabled", e.target.checked)} />
                                {t("aichat.mcpEnabled")}
                              </label>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm(t("aichat.confirmDeleteMcp"))) removeMcpService(svc.id); }}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* JSON paste mode */}
                {mcpSubTab === "json" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">{t("aichat.mcpJsonPaste")}</p>
                    <Textarea
                      value={mcpJsonText}
                      onChange={e => setMcpJsonText(e.target.value)}
                      placeholder={t("aichat.mcpJsonPlaceholder")}
                      className="min-h-[200px] font-mono text-xs"
                    />
                    {mcpJsonError && (
                      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                        {mcpJsonError}
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setMcpJsonText(""); setMcpJsonError(null); }}>
                        {t("common.clear")}
                      </Button>
                      <Button size="sm" onClick={handleMcpJsonImport} disabled={!mcpJsonText.trim()}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> {t("aichat.mcpJsonImport")}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Config File mode */}
                {mcpSubTab === "file" && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium">{t("aichat.mcpConfigFiles")}</p>
                      <p className="text-xs text-muted-foreground">{t("aichat.mcpConfigFilesDesc")}</p>
                    </div>
                    <div className="space-y-2">
                      {mcpClients.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                      ) : (
                        mcpClients.map(client => (
                          <div key={client.key} className="rounded-md border border-border p-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={client.status === "configured" ? "success" : client.status === "file-not-found" ? "warning" : "secondary"}>
                                  {client.displayName}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{client.status}</span>
                              </div>
                              {client.configPath && (
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleReadFile(client.configPath)}>
                                    {t("aichat.mcpEditFile")}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => tauri.openInEditor(client.configPath)}>
                                    {t("aichat.mcpOpenFile")}
                                  </Button>
                                </div>
                              )}
                            </div>
                            {client.configPath && (
                              <code className="block text-[10px] text-muted-foreground break-all">{client.configPath}</code>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* File editor */}
                    {editingFilePath && (
                      <div className="space-y-2 rounded-md border border-primary/50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-muted-foreground truncate max-w-md">{editingFilePath}</code>
                            {fileSaved && <Badge variant="success">{t("aichat.mcpFileSaved")}</Badge>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => tauri.openInEditor(editingFilePath)}>
                              {t("aichat.mcpOpenFile")}
                            </Button>
                            <Button size="sm" className="h-6 text-xs" onClick={handleSaveFile}>
                              {t("aichat.mcpSaveFile")}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6" onClick={() => { setEditingFilePath(null); setFileContent(""); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          value={fileContent}
                          onChange={e => setFileContent(e.target.value)}
                          className="min-h-[300px] font-mono text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Skills tab */}
            {settingsTab === "skills" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{t("aichat.skills")}</span>
                    <p className="text-xs text-muted-foreground">{t("aichat.skillsDesc")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addSkillViaChat}>
                      <Sparkles className="mr-1 h-3.5 w-3.5" /> {t("aichat.skillAddViaChat")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={addSkill}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> {t("aichat.addSkill")}
                    </Button>
                  </div>
                </div>
                {settings.skills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("aichat.noSkills")}</p>
                ) : (
                  <div className="space-y-2">
                    {settings.skills.map(skill => (
                      <div key={skill.id} className="rounded-md border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Input value={skill.name} onChange={e => updateSkill(skill.id, "name", e.target.value)} className="h-8 text-sm" />
                          <div className="flex gap-1 ml-2">
                            <label className="flex items-center gap-1 text-xs">
                              <input type="checkbox" checked={skill.enabled} onChange={e => updateSkill(skill.id, "enabled", e.target.checked)} />
                              {t("aichat.skillEnabled")}
                            </label>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm(t("aichat.confirmDeleteSkill"))) removeSkill(skill.id); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <Textarea value={skill.prompt} onChange={e => updateSkill(skill.id, "prompt", e.target.value)} placeholder={t("aichat.skillPrompt")} className="text-xs" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto rounded-md border border-border bg-black/20 p-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={cn(
              "group max-w-[75%] rounded-lg p-3 text-sm",
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
            )}>
              {renderMessage(msg, i)}
              {msg.role === "assistant" && !msg.thinking && msg.content && (
                <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => copyToClipboard(msg.content)}
                  >
                    <Copy className="h-3 w-3" /> {t("aichat.copyResponse")}
                  </button>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("aichat.chatPlaceholder")}
          disabled={sending}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={sending || !input.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
