import { useEffect, useState } from "react";
import { Bot, RefreshCw, Plug, Package, Terminal, Cpu, Settings2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner, EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { useI18n } from "@/i18n";
import { useToastStore } from "@/stores/useToastStore";
import * as tauri from "@/lib/tauri";
import type { EditorStatus, McpClientInfo, PipelineEntry } from "@/lib/tauri";

export function McpAi() {
  const { t } = useI18n();
  const [statuses, setStatuses] = useState<EditorStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineData, setPipelineData] = useState<PipelineEntry[]>([]);
  const [mcpClients, setMcpClients] = useState<McpClientInfo[]>([]);
  const [copiedClient, setCopiedClient] = useState<string | null>(null);
  const showToast = useToastStore(s => s.addToast);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [st, pipe, mcpList] = await Promise.allSettled([tauri.getStatus(), tauri.pipelineList(), tauri.listMcpClients()]);
      if (st.status === "fulfilled") setStatuses(st.value);
      if (pipe.status === "fulfilled") setPipelineData(pipe.value || []);
      if (mcpList.status === "fulfilled") setMcpClients(mcpList.value || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleConfigure = async (clientId: string) => {
    try { await tauri.configureMcpClient({ client: clientId }); showToast("success", `${t("mcp.configure")}: ${clientId}`); loadData(); }
    catch (e: any) { showToast("error", e.message); }
  };

  const handleDryRunCopy = async (clientId: string) => {
    try {
      const result = await tauri.configureMcpClient({ client: clientId, dryRun: true });
      navigator.clipboard.writeText(result);
      setCopiedClient(clientId);
      setTimeout(() => setCopiedClient(null), 2000);
    } catch (e: any) { showToast("error", e.message); }
  };

  const isConfigured = (client: McpClientInfo) => client.status === "configured";

  return (
    <div className="space-y-4">
      <PageHeader title={t("mcp.title")} description={t("mcp.desc")}>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("common.refresh")}
        </Button>
      </PageHeader>

      {error && <ErrorState message={error} />}
      {loading && <LoadingSpinner className="h-6 w-6" />}

      {/* Connected editors */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4" /> {t("mcp.connectedEditors")}</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {statuses.length === 0 ? <EmptyState message={t("mcp.noConnectedEditors")} /> :
              statuses.map((st, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <span className="font-mono text-sm flex-1">{st.version || "—"}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-xs">{st.project || st.projectPath || "—"}</span>
                  <span className="font-mono text-xs">Port: {st.port || "—"}</span>
                  <Badge variant={st.state === "ready" ? "success" : "secondary"}>{st.state || "—"}</Badge>
                </div>
              ))
            }
          </div>
        </CardContent>
      </Card>

      {/* MCP client configuration */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> {t("mcp.mcpClients")}</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">{t("mcp.mcpClientsDesc")}</p>
          <div className="grid grid-cols-2 gap-2">
            {mcpClients.map((client) => (
              <div key={client.key} className="flex items-center justify-between rounded-md border border-border p-2">
                <div className="flex items-center gap-2">
                  <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <span className="text-sm">{client.displayName}</span>
                    {isConfigured(client) && <Badge variant="success" className="ml-2">✓</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title={t("aichat.copyResponse")} onClick={() => handleDryRunCopy(client.key)}>
                    {copiedClient === client.key ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleConfigure(client.key)}>
                    {isConfigured(client) ? t("mcp.configure") : t("mcp.configure")}
                  </Button>
                </div>
              </div>
            ))}
            {mcpClients.length === 0 && !loading && (
              <p className="col-span-2 text-sm text-muted-foreground">{t("mcp.noConnectedEditors")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> {t("mcp.pipelineStatus")}
            <Button variant="outline" size="sm" className="ml-auto" onClick={async () => {
              try { await tauri.pipelineInstall(undefined, false); showToast("success", t("mcp.configure")); loadData(); }
              catch (e: any) { showToast("error", e.message); }
            }}>
              <Package className="mr-1 h-3.5 w-3.5" /> {t("mcp.configure")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {pipelineData.length === 0 ? (
              <div className="p-3 space-y-2">
                <p className="text-sm text-muted-foreground">{t("mcp.noConnectedEditors")}</p>
                <p className="text-xs text-muted-foreground">{t("mcp.pipelineHint")}</p>
                <Button variant="outline" size="sm" onClick={async () => {
                  try { await tauri.pipelineInstall(undefined, false); showToast("success", t("mcp.configure")); loadData(); }
                  catch (e: any) { showToast("error", e.message); }
                }}>
                  <Package className="mr-1 h-3.5 w-3.5" /> {t("mcp.installPipeline")}
                </Button>
              </div>
            ) : (
              pipelineData.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.projectName || p.projectPath || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("editors.version")}: {p.pipelineVersion || t("mcp.notInstalled")}
                    </p>
                  </div>
                  {p.hasPipelinePackage ? (
                    p.isRunning ? <Badge variant="success">{t("status.running")}</Badge> : <Badge variant="secondary">{t("mcp.installed")}</Badge>
                  ) : (
                    <Badge variant="warning">{t("mcp.notInstalled")}</Badge>
                  )}
                  <div className="flex gap-1">
                    {!p.hasPipelinePackage && (
                      <Button variant="ghost" size="sm" onClick={async () => {
                        try { await tauri.pipelineInstall(p.projectPath || undefined, false); showToast("success", t("mcp.configure")); loadData(); }
                        catch (e: any) { showToast("error", e.message); }
                      }}>{t("common.install")}</Button>
                    )}
                    {p.hasPipelinePackage && (
                      <Button variant="ghost" size="sm" onClick={async () => {
                        try { await tauri.pipelineUpgrade(p.projectPath || undefined); showToast("success", t("editors.upgrade")); loadData(); }
                        catch (e: any) { showToast("error", e.message); }
                      }}>{t("editors.upgrade")}</Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom commands */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Terminal className="h-4 w-4" /> {t("mcp.customCommands")}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={async () => { try { await tauri.listEditorCommands(); showToast("success", t("mcp.listCommands")); } catch (e: any) { showToast("error", e.message); } }}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("mcp.listCommands")}
            </Button>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-3.5 w-3.5" /> {t("mcp.executeCommand")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("mcp.commandsDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
