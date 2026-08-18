import { invoke } from "@tauri-apps/api/core";

// ═════════════════════════════════════════════════════════════════════════════
//  Types (shared by both Tauri and uTools channels)
// ═════════════════════════════════════════════════════════════════════════════

export interface Editor {
  version: string;
  alias: string;
  architecture: string;
  location?: string;
  modules?: string;
  upgradeTo?: string;
  default: boolean;
}

export interface Release {
  version: string;
  stream: string;
  lts: boolean;
  releaseDate?: string;
  downloadUrl?: string;
  changeset?: string;
}

export interface RunningEditor {
  version: string;
  pid: number;
  projectPath?: string;
  projectName?: string;
  port?: number;
  hasPipeline?: boolean;
  reachable?: boolean;
}

export interface Project {
  title: string;
  path: string;
  version: string;
  architecture: string;
  changeset?: string;
  isFavorite: boolean;
  cloudEnabled: boolean;
  buildTarget?: string;
  renderPipeline?: string;
  lastModified?: number;
  localProjectId?: string;
  vcsConfigurationPath?: string;
}

export interface CacheInfo {
  path: string;
  sizeBytes: number;
  size: string;
  fileCount: number;
  unreadable: boolean;
}

export interface EnvInfo {
  userDataPath: string;
  editorInstallPath: string;
  downloadCachePath: string;
  configPath: string;
  hubVersion: string;
}

export interface EditorStatus {
  port?: number;
  project?: string;
  projectPath?: string;
  version?: string;
  pid?: number;
  state?: string;
}

export interface PipelineEntry {
  projectName?: string;
  projectPath?: string;
  pid?: number;
  isRunning?: boolean;
  hasPipelinePackage?: boolean;
  pipelineVersion?: string;
  updateAvailable?: boolean;
}

export interface McpClientInfo {
  key: string;
  displayName: string;
  configPath?: string | null;
  status: string;
}

export interface LanguageEntry {
  code: string;
  name: string;
}

export interface LanguageInfo {
  current?: string;
  name?: string;
  available: LanguageEntry[];
}

export interface AuthInfo {
  loggedIn: boolean;
  user?: {
    name?: string;
    email?: string;
  };
}

export interface ProjectMeta {
  customName?: string;
  iconType?: "emoji" | "color" | "image" | null;
  iconValue?: string;
  openEditorVersion?: string;
  openBuildTarget?: string;
  openArchitecture?: string;
  openExtraArgs?: string;
  notes?: string;
}

export interface ProxyInfo {
  url?: string | null;
  source?: string;
}

export interface AnalyticsInfo {
  optedIn: boolean;
}

export interface UpgradeInfo {
  currentVersion: string;
  latestVersion: string;
  platform?: string;
}

export interface ProcessHandle {
  id: number;
  command: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

// ═════════════════════════════════════════════════════════════════════════════
//  Generic backend primitives — the ONLY functions implemented in Rust / preload.js
// ═════════════════════════════════════════════════════════════════════════════

/** Run `unity --json --no-banner <args>`, parse the {success, data, errors} envelope, return data. */
const runUnityJson = (args: string[]) => invoke<any>("run_unity_json", { args });

/** Run `unity <args>`, return raw stdout as string. */
const runUnityPlain = (args: string[]) => invoke<string>("run_unity_plain", { args });

/** Start a streaming unity process. Events: `<prefix>-stdout/stderr/exit`. */
const startStreaming = (prefix: string, args: string[], includeJsonFlags: boolean) =>
  invoke<ProcessHandle>("start_streaming", { prefix, args, includeJsonFlags });

/** Start an arbitrary shell command (for CLI install). Events: `<prefix>-stdout/stderr/exit`. */
const startRawStream = (prefix: string, shellCmd: string) =>
  invoke<ProcessHandle>("start_raw_stream", { prefix, shellCmd });

// ═════════════════════════════════════════════════════════════════════════════
//  Editors
// ═════════════════════════════════════════════════════════════════════════════

export const listEditors = (): Promise<Editor[]> => runUnityJson(["editors", "--installed"]);

export const listReleases = (opts?: { lts?: boolean; stream?: string; since?: number; limit?: number }) => {
  const args = ["releases"];
  if (opts?.lts) args.push("--lts");
  if (opts?.stream) { args.push("--stream", opts.stream); }
  if (opts?.since !== undefined) { args.push("--since", String(opts.since)); }
  if (opts?.limit !== undefined) { args.push("--limit", String(opts.limit)); }
  return runUnityJson(args);
};

export const listRunningEditors = async () => {
  const resp = await runUnityJson(["editors", "running"]);
  return (resp.instances || []) as RunningEditor[];
};

export const editorInfo = (version: string) => runUnityJson(["editors", "info", version]);
export const editorPath = (version: string) => runUnityPlain(["editors", "path", version]);
export const setDefaultEditor = (version: string) => runUnityJson(["editors", "default", version]);
export const unsetDefaultEditor = () => runUnityJson(["editors", "default", "--unset"]);
export const getDefaultEditor = () => runUnityJson(["editors", "default"]);
export const uninstallEditor = (version: string) => runUnityJson(["uninstall", version, "--yes"]);
export const listModules = (version: string) => runUnityJson(["editors", "module", "list", version]);

export const addModules = (version: string, modules: string[], architecture?: string, acceptEula?: boolean) => {
  const args = ["editors", "module", "add", version, "--module", modules.join(" ")];
  if (architecture) args.push("--architecture", architecture);
  if (acceptEula) args.push("--accept-eula");
  args.push("--yes");
  return runUnityJson(args);
};

export const removeModules = (version: string, modules: string[], architecture?: string) => {
  const args = ["editors", "module", "remove", version, "--module", modules.join(" ")];
  if (architecture) args.push("--architecture", architecture);
  args.push("--yes");
  return runUnityJson(args);
};

export const checkEditorUpgrades = () => runUnityJson(["editors", "upgrade", "--check"]);
export const getInstallPath = () => runUnityJson(["editors", "install-path"]);
export const setInstallPath = (path: string) => runUnityJson(["editors", "install-path", "--set", path]);

export const editorsUpgrade = (version: string, replace?: boolean) => {
  const args = ["editors", "upgrade", version, "--yes", "--accept-eula"];
  if (replace) args.push("--replace");
  return runUnityJson(args);
};

export const refreshModules = (version: string) => runUnityJson(["editors", "module", "refresh", version]);

// ═════════════════════════════════════════════════════════════════════════════
//  Projects
// ═════════════════════════════════════════════════════════════════════════════

export const listProjects = (): Promise<Project[]> => runUnityJson(["projects", "list", "-a"]);

export const projectInfo = (pathOrName?: string) => {
  const args = ["projects", "info"];
  if (pathOrName) args.push(pathOrName);
  return runUnityJson(args);
};

export const openProject = (project: string, editorVersion?: string) => {
  const args = ["open", project];
  if (editorVersion) args.push("--editor-version", editorVersion);
  return runUnityJson(args);
};

export const openProjectWithParams = (opts: {
  project: string;
  editorVersion?: string;
  editorPath?: string;
  architecture?: string;
  buildTarget?: string;
  buildTargetGroup?: string;
  extraArgs?: string;
}) => {
  const args = ["open", opts.project];
  if (opts.editorVersion) args.push("--editor-version", opts.editorVersion);
  if (opts.editorPath) args.push("--editor-path", opts.editorPath);
  if (opts.architecture) args.push("--architecture", opts.architecture);
  if (opts.buildTarget) args.push("--build-target", opts.buildTarget);
  if (opts.buildTargetGroup) args.push("--build-target-group", opts.buildTargetGroup);
  if (opts.extraArgs) args.push("--args", opts.extraArgs);
  return runUnityJson(args);
};

export const projectRequire = (pathOrName?: string) => {
  const args = ["projects", "require"];
  if (pathOrName) args.push(pathOrName);
  args.push("--yes");
  return runUnityJson(args);
};

export const projectSize = (project?: string, all?: boolean) => {
  const args = ["projects", "size"];
  if (all) args.push("--all");
  else if (project) args.push(project);
  return runUnityJson(args);
};

export const pinProject = (pattern: string) => runUnityJson(["projects", "pin", pattern]);
export const unpinProject = (pattern: string) => runUnityJson(["projects", "unpin", pattern]);
export const removeProject = (path: string) => runUnityJson(["projects", "remove", path]);

export const upgradeProject = (pathOrName: string | undefined, toVersion: string) => {
  const args = ["projects", "upgrade"];
  if (pathOrName) args.push(pathOrName);
  args.push("--to", toVersion, "--yes");
  return runUnityJson(args);
};

export const createProject = (opts: {
  name: string;
  path?: string;
  editorVersion?: string;
  template?: string;
  open?: boolean;
}) => {
  const args = ["projects", "new", opts.name];
  if (opts.path) args.push("--path", opts.path);
  if (opts.editorVersion) args.push("--editor-version", opts.editorVersion);
  if (opts.template) args.push("--template", opts.template);
  if (opts.open) args.push("--open");
  return runUnityJson(args);
};

export const addExistingProject = (path: string) => runUnityJson(["projects", "add", path]);

export const projectClone = (opts: {
  vcs: string; vcsNamespace: string; vcsRepo: string;
  gitToken?: string; refName?: string; destPath?: string; projectPath?: string;
}) => {
  const args = ["projects", "clone", "--vcs", opts.vcs, "--vcs-namespace", opts.vcsNamespace, "--vcs-repo", opts.vcsRepo];
  if (opts.refName) args.push("--ref", opts.refName);
  if (opts.destPath) args.push("--path", opts.destPath);
  if (opts.projectPath) args.push("--project-path", opts.projectPath);
  if (opts.gitToken) args.push("--git-token", opts.gitToken);
  return runUnityJson(args);
};

export const projectLink = (projectPath?: string, linkType?: string) => {
  const args = ["projects", "link", linkType || "cloud"];
  if (projectPath) args.push(projectPath);
  return runUnityJson(args);
};

export const projectUnlink = (projectPath?: string, linkType?: string) => {
  const args = ["projects", "unlink", linkType || "cloud"];
  if (projectPath) args.push(projectPath);
  return runUnityJson(args);
};

export const projectsExport = (outputFile?: string) => {
  const args = ["projects", "export"];
  if (outputFile) args.push("--output", outputFile);
  return runUnityPlain(args);
};

export const projectsImport = (inputFile?: string) => {
  const args = ["projects", "import"];
  if (inputFile) args.push(inputFile);
  return runUnityJson(args);
};

export const submitBug = (opts: { title: string; description: string; email?: string; steps?: string[]; reproducibility?: string }) => {
  const args = ["bug", "--title", opts.title, "--description", opts.description];
  if (opts.email) args.push("--email", opts.email);
  if (opts.steps && opts.steps.length > 0) { args.push("--steps"); args.push(...opts.steps); }
  if (opts.reproducibility) args.push("--reproducibility", opts.reproducibility);
  return runUnityJson(args);
};

export const cloudProjectList = (cloudOrg?: string) => {
  const args = ["cloud", "project", "list"];
  if (cloudOrg) args.push("--cloud-org", cloudOrg);
  return runUnityJson(args);
};

export const licenseServerList = () => runUnityJson(["license", "server", "list"]);
export const licenseServerStatus = () => runUnityJson(["license", "server", "status"]);

export const templateCreate = (opts: {
  projectPath: string; name: string; displayName?: string;
  description?: string; templateVersion?: string; output?: string;
}) => {
  const args = ["templates", "create", opts.projectPath, "--name", opts.name];
  if (opts.displayName) args.push("--display-name", opts.displayName);
  if (opts.description) args.push("--description", opts.description);
  if (opts.templateVersion) args.push("--template-version", opts.templateVersion);
  if (opts.output) args.push("--output", opts.output);
  return runUnityJson(args);
};

export const templateDelete = (name: string) => runUnityJson(["templates", "delete", name]);

export const templateLocation = (setPath?: string) => {
  const args = ["templates", "location"];
  if (setPath) args.push("--set", setPath);
  return runUnityJson(args);
};

export const templateEdit = (name: string) => runUnityJson(["templates", "edit", name]);

export const listTemplates = (editorVersion?: string, installedOnly?: boolean) => {
  const args = ["templates", "list"];
  if (editorVersion) args.push("--editor", editorVersion);
  if (installedOnly) args.push("--installed");
  return runUnityJson(args);
};

export const cacheInfo = (): Promise<CacheInfo> => runUnityJson(["cache", "info"]);
export const cacheClean = () => runUnityJson(["cache", "clean", "--yes"]);
export const getEnv = (): Promise<EnvInfo> => runUnityJson(["env"]);

// ═════════════════════════════════════════════════════════════════════════════
//  Build / Test / Process (streaming)
// ═════════════════════════════════════════════════════════════════════════════

export const startBuild = (opts: {
  project: string; target: string; executeMethod: string;
  outputPath?: string; editorVersion?: string; architecture?: string;
  logFile?: string; allowInstall?: boolean; noTail?: boolean; extraArgs?: string;
}) => {
  const args = ["build", opts.project, "--target", opts.target, "--execute-method", opts.executeMethod];
  if (opts.outputPath) args.push("--output-path", opts.outputPath);
  if (opts.editorVersion) args.push("--editor-version", opts.editorVersion);
  if (opts.architecture) args.push("--architecture", opts.architecture);
  if (opts.logFile) args.push("--log-file", opts.logFile);
  if (opts.allowInstall) args.push("--allow-install");
  if (opts.noTail) args.push("--no-tail");
  if (opts.extraArgs) args.push("--args", opts.extraArgs);
  return startStreaming("build", args, false);
};

export const startTest = (opts: {
  project: string; mode?: string; filter?: string; output?: string;
  editorVersion?: string; timeout?: number;
}) => {
  const args = ["test", opts.project];
  if (opts.mode) args.push("--mode", opts.mode);
  if (opts.filter) args.push("--filter", opts.filter);
  if (opts.output) args.push("--output", opts.output);
  if (opts.editorVersion) args.push("--editor-version", opts.editorVersion);
  if (opts.timeout !== undefined) args.push("--timeout", String(opts.timeout));
  return startStreaming("test", args, false);
};

export const startInstallEditor = (opts: {
  version: string; modules?: string[]; architecture?: string; childModules?: boolean;
}) => {
  const args = ["install", opts.version, "--yes", "--accept-eula"];
  if (opts.modules && opts.modules.length > 0) args.push("--module", opts.modules.join(" "));
  if (opts.architecture) args.push("--architecture", opts.architecture);
  if (opts.childModules) args.push("--childModules");
  return startStreaming("install", args, false);
};

export const cancelProcess = (id: number) => invoke("cancel_process", { id });

export const buildCommandString = (args: string[], json: boolean) => {
  const parts = ["unity"];
  if (json) parts.push("--json");
  parts.push(...args);
  return Promise.resolve(parts.join(" "));
};

export const checkUnityAvailable = () => invoke<boolean>("check_unity_available");
export const getUnityPath = () => invoke<string>("get_unity_path");

export const runUnityCommand = (args: string[], json = true) =>
  runUnityPlain(json ? ["--json", "--no-banner", ...args] : args);

// ═════════════════════════════════════════════════════════════════════════════
//  MCP / Status / Pipeline
// ═════════════════════════════════════════════════════════════════════════════

export const getStatus = async (projectPath?: string) => {
  const args = ["status"];
  if (projectPath) { args.push("--project-path", projectPath); }
  const resp = await runUnityJson(args);
  return (resp.instances || []) as EditorStatus[];
};

export const pipelineList = async () => {
  const resp = await runUnityJson(["pipeline", "list"]);
  return (resp.instances || []) as PipelineEntry[];
};

export const pipelineListVersions = () => runUnityJson(["pipeline", "list-versions"]);

export const pipelineInstall = (projectPath?: string, force?: boolean) => {
  const args = ["pipeline", "install"];
  if (projectPath) args.push("--project-path", projectPath);
  if (force) args.push("--force");
  return runUnityJson(args);
};

export const pipelineUpgrade = (projectPath?: string) => {
  const args = ["pipeline", "upgrade"];
  if (projectPath) args.push("--project-path", projectPath);
  return runUnityJson(args);
};

export const listEditorCommands = (projectPath?: string) => {
  const args = ["list"];
  if (projectPath) args.push("--project-path", projectPath);
  return runUnityJson(args);
};

export const executeEditorCommand = (opts: {
  command: string; args?: string[]; projectPath?: string; timeout?: number;
}) => {
  const cmdArgs = ["command", opts.command];
  if (opts.args) cmdArgs.push(...opts.args);
  if (opts.projectPath) cmdArgs.push("--project-path", opts.projectPath);
  if (opts.timeout !== undefined) cmdArgs.push("--timeout", String(opts.timeout));
  return runUnityJson(cmdArgs);
};

export const listMcpClients = (): Promise<McpClientInfo[]> => runUnityJson(["mcp", "configure", "--list"]);

export const configureMcpClient = (opts: {
  client: string; projectPath?: string; local?: boolean; dryRun?: boolean;
}) => {
  const args = ["mcp", "configure", opts.client];
  if (opts.projectPath) args.push("--project-path", opts.projectPath);
  if (opts.local) args.push("--local");
  if (opts.dryRun) args.push("--dry-run");
  args.push("--yes");
  return runUnityPlain(args);
};

// ═════════════════════════════════════════════════════════════════════════════
//  Settings / Logs / Diagnostics
// ═════════════════════════════════════════════════════════════════════════════

export const startLogStream = (opts: { follow?: boolean; level?: string; tail?: number }) => {
  const args = ["logs"];
  if (opts.follow) args.push("--follow");
  if (opts.level) args.push("--level", opts.level);
  if (opts.tail !== undefined) args.push("--tail", String(opts.tail));
  return startStreaming("logs", args, false);
};

export const runDoctor = () => runUnityPlain(["doctor"]);
export const runDiagnose = () => runUnityPlain(["diagnose"]);

// Auth — compound commands (plain then json)
export const authStatus = (): Promise<AuthInfo> => runUnityJson(["auth", "status"]);

export const authLogin = async (): Promise<AuthInfo> => {
  // Launch `unity auth login` in the background (non-blocking) — it opens the browser.
  // We do NOT await its exit because it blocks waiting for an OAuth callback that
  // uTools/Tauri can't always intercept. Instead, poll `auth status` to detect completion.
  // The launched process is tracked under "auth-login" prefix for potential cancellation.
  startStreaming("auth-login", ["auth", "login"], false).catch(() => {});

  // Poll auth status until logged in or ~3 min timeout
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const status = await authStatus();
      if (status?.loggedIn) return status;
    } catch {}
  }
  throw new Error("Login timed out — please retry");
};

export const authLogout = async () => {
  await runUnityPlain(["auth", "logout"]);
  return runUnityJson(["auth", "status"]);
};

// License
export const licenseStatus = () => runUnityJson(["license", "status"]);
export const listLicenses = () => runUnityJson(["license", "list"]);

export const licenseActivate = (opts: {
  serial?: string; personal?: boolean; floating?: boolean;
  file?: string; acceptEula?: boolean;
}) => {
  const args = ["license", "activate"];
  if (opts.personal) args.push("--personal");
  if (opts.floating) args.push("--floating");
  if (opts.serial) args.push("--serial", opts.serial);
  if (opts.file) args.push("--file", opts.file);
  if (opts.acceptEula || opts.personal) args.push("--accept-eula");
  return runUnityJson(args);
};

export const licenseReturn = () => runUnityJson(["license", "return", "--yes"]);

// Cloud
export const cloudStatus = () => runUnityJson(["cloud", "status"]);
export const listCloudOrgs = () => runUnityJson(["cloud", "org", "list"]);

// Language
export const getLanguage = (): Promise<LanguageInfo> => runUnityJson(["language"]);
export const setLanguage = (code: string) => runUnityJson(["language", "--set", code]);

// Proxy
export const getProxy = (): Promise<ProxyInfo> => runUnityJson(["config", "proxy"]);

export const setProxy = (url: string, bypass?: string) => {
  const args = ["config", "proxy", url];
  if (bypass) args.push("--bypass", bypass);
  return runUnityJson(args);
};

export const unsetProxy = () => runUnityJson(["config", "proxy", "--unset"]);

// Analytics
export const analyticsStatus = (): Promise<AnalyticsInfo> => runUnityJson(["analytics", "status"]);
export const analyticsOptIn = () => runUnityJson(["analytics", "opt-in"]);
export const analyticsOptOut = () => runUnityJson(["analytics", "opt-out"]);

// CLI update
export const checkCliUpdate = (): Promise<UpgradeInfo> => runUnityJson(["upgrade", "--check"]);
export const getChangelog = () => runUnityPlain(["changelog"]);
export const getUpdateCheck = () => runUnityJson(["config", "update-check"]);
export const setUpdateCheck = (state: string) => runUnityJson(["config", "update-check", state]);

export const startCliUpgrade = (yes?: boolean) => {
  const args = ["upgrade"];
  if (yes) args.push("--yes");
  return startStreaming("upgrade", args, false);
};

// Hub
export const installHub = () => runUnityJson(["hub", "install", "--force"]);
export const checkHubInstalled = () => invoke<{ installed: boolean; path: string }>("check_hub_installed");

// CLI self-uninstall (blocking)
export const selfUninstall = (purge?: boolean) => {
  const args = ["self-uninstall", "--yes"];
  if (purge) args.push("--purge");
  return runUnityJson(args);
};

// CLI streaming uninstall (with log capture)
export const startCliUninstall = (purge?: boolean) => {
  const args = ["self-uninstall", "--yes"];
  if (purge) args.push("--purge");
  return startStreaming("cli-uninstall", args, true);
};

// CLI install via official script
export const installUnityCli = () => {
  const isWin = typeof navigator !== "undefined" && navigator.platform.includes("Win");
  const shellCmd = isWin
    ? "$env:UNITY_CLI_CHANNEL='beta'; irm https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.ps1 | iex"
    : "curl -fsSL https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.sh | UNITY_CLI_CHANNEL=beta bash";
  return startRawStream("cli-install", shellCmd);
};

// ═════════════════════════════════════════════════════════════════════════════
//  Platform-specific (can't be expressed as unity CLI calls — backend implements)
// ═════════════════════════════════════════════════════════════════════════════

export const revealInFileManager = (path: string) => invoke("reveal_in_file_manager", { path });
export const openTerminalAtPath = (path: string) => invoke("open_terminal_at_path", { path });
export const openInEditor = (path: string) => invoke("open_in_editor", { path });
export const getGitInfo = (projectPath: string) =>
  invoke<{ isGit: boolean; branch?: string; repoUrl?: string; dirty?: boolean }>("get_git_info", { projectPath });
export const getProjectMeta = (projectPath: string) => invoke<ProjectMeta>("get_project_meta", { projectPath });
export const setProjectMeta = (projectPath: string, meta: ProjectMeta) =>
  invoke("set_project_meta", { projectPath, meta });
export const getSystemLocale = () => invoke<string>("get_system_locale");
export const readFileContent = (path: string) => invoke<string>("read_file_content", { path });
export const writeFileContent = (path: string, content: string) => invoke("write_file_content", { path, content });

// ═════════════════════════════════════════════════════════════════════════════
//  AI Chat (HTTP — backend implements)
// ═════════════════════════════════════════════════════════════════════════════

export const aiChat = (opts: {
  gatewayUrl: string; apiKey: string; model: string;
  messages: ChatMessage[]; maxTokens?: number; temperature?: number;
}) => invoke<string>("ai_chat", opts);

export const aiTestConnection = (gatewayUrl: string, apiKey: string, model: string) =>
  invoke<string>("ai_chat", {
    gatewayUrl, apiKey, model,
    messages: [{ role: "user", content: "Hi" }],
    maxTokens: 10, temperature: 0,
  });
