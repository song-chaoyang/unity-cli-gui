import { invoke } from "@tauri-apps/api/core";

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Editors ─────────────────────────────────────────────────────────────────

export const listEditors = () => invoke<Editor[]>("list_editors");
export const listReleases = (opts?: { lts?: boolean; stream?: string; since?: number; limit?: number }) =>
  invoke<Release[]>("list_releases", opts);
export const listRunningEditors = () => invoke<RunningEditor[]>("list_running_editors");
export const editorInfo = (version: string) => invoke<any>("editor_info", { version });
export const editorPath = (version: string) => invoke<string>("editor_path", { version });
export const setDefaultEditor = (version: string) => invoke("set_default_editor", { version });
export const unsetDefaultEditor = () => invoke("unset_default_editor");
export const getDefaultEditor = () => invoke<any>("get_default_editor");
export const uninstallEditor = (version: string) => invoke("uninstall_editor", { version });
export const listModules = (version: string) => invoke<any>("list_modules", { version });
export const addModules = (version: string, modules: string[], architecture?: string, acceptEula?: boolean) =>
  invoke("add_modules", { version, modules, architecture, acceptEula });
export const removeModules = (version: string, modules: string[], architecture?: string) =>
  invoke("remove_modules", { version, modules, architecture });
export const checkEditorUpgrades = () => invoke<any>("check_editor_upgrades");
export const getInstallPath = () => invoke<any>("get_install_path");
export const setInstallPath = (path: string) => invoke("set_install_path", { path });
export const editorsUpgrade = (version: string, replace?: boolean) => invoke("editors_upgrade", { version, replace });

// ─── Projects ───────────────────────────────────────────────────────────────

export const listProjects = () => invoke<Project[]>("list_projects");
export const projectInfo = (pathOrName?: string) => invoke<any>("project_info", { pathOrName });
export const openProject = (project: string, editorVersion?: string) =>
  invoke("open_project", { project, editorVersion });
export const openProjectWithParams = (opts: {
  project: string;
  editorVersion?: string;
  editorPath?: string;
  architecture?: string;
  buildTarget?: string;
  buildTargetGroup?: string;
  extraArgs?: string;
}) => invoke("open_project_with_params", opts);
export const projectRequire = (pathOrName?: string) => invoke("project_require", { pathOrName });
export const projectSize = (project?: string, all?: boolean) => invoke<any>("project_size", { project, all });
export const pinProject = (pattern: string) => invoke("pin_project", { pattern });
export const unpinProject = (pattern: string) => invoke("unpin_project", { pattern });
export const removeProject = (path: string) => invoke("remove_project", { path });
export const upgradeProject = (pathOrName: string | undefined, toVersion: string) =>
  invoke("upgrade_project", { pathOrName, toVersion });
export const createProject = (opts: {
  name: string;
  path?: string;
  editorVersion?: string;
  template?: string;
  open?: boolean;
}) => invoke("create_project", opts);
export const addExistingProject = (path: string) => invoke("add_existing_project", { path });
export const revealInFileManager = (path: string) => invoke("reveal_in_file_manager", { path });
export const openTerminalAtPath = (path: string) => invoke("open_terminal_at_path", { path });
export const openInEditor = (path: string) => invoke("open_in_editor", { path });
export const getGitInfo = (projectPath: string) => invoke<{ isGit: boolean; branch?: string; repoUrl?: string; dirty?: boolean }>("get_git_info", { projectPath });
export const getProjectMeta = (projectPath: string) => invoke<ProjectMeta>("get_project_meta", { projectPath });
export const setProjectMeta = (projectPath: string, meta: ProjectMeta) =>
  invoke("set_project_meta", { projectPath, meta });
export const projectClone = (opts: { vcs: string; vcsNamespace: string; vcsRepo: string; gitToken?: string; refName?: string; destPath?: string; projectPath?: string }) =>
  invoke("project_clone", opts);
export const projectLink = (projectPath?: string, linkType?: string) => invoke("project_link", { projectPath, linkType });
export const projectUnlink = (projectPath?: string, linkType?: string) => invoke("project_unlink", { projectPath, linkType });
export const projectsExport = (outputFile?: string) => invoke<string>("projects_export", { outputFile });
export const projectsImport = (inputFile?: string) => invoke("projects_import", { inputFile });
export const refreshModules = (version: string) => invoke<any>("refresh_modules", { version });
export const submitBug = (opts: { title: string; description: string; email?: string; steps?: string[]; reproducibility?: string }) =>
  invoke("submit_bug", opts);
export const cloudProjectList = (cloudOrg?: string) => invoke<any>("cloud_project_list", { cloudOrg });
export const licenseServerList = () => invoke<any>("license_server_list");
export const licenseServerStatus = () => invoke<any>("license_server_status");
export const templateCreate = (opts: { projectPath: string; name: string; displayName?: string; description?: string; templateVersion?: string; output?: string }) =>
  invoke("template_create", opts);
export const templateDelete = (name: string) => invoke("template_delete", { name });
export const templateLocation = (setPath?: string) => invoke<any>("template_location", { setPath });
export const templateEdit = (name: string) => invoke("template_edit", { name });
export const listTemplates = (editorVersion?: string, installedOnly?: boolean) =>
  invoke<any>("list_templates", { editorVersion, installedOnly });
export const cacheInfo = () => invoke<CacheInfo>("cache_info");
export const cacheClean = () => invoke("cache_clean");
export const getEnv = () => invoke<EnvInfo>("get_env");

// ─── Build / Test / Process ─────────────────────────────────────────────────

export const startBuild = (opts: {
  project: string;
  target: string;
  executeMethod: string;
  outputPath?: string;
  editorVersion?: string;
  architecture?: string;
  logFile?: string;
  allowInstall?: boolean;
  noTail?: boolean;
  extraArgs?: string;
}) => invoke<ProcessHandle>("start_build", opts);

export const startTest = (opts: {
  project: string;
  mode?: string;
  filter?: string;
  output?: string;
  editorVersion?: string;
  timeout?: number;
}) => invoke<ProcessHandle>("start_test", opts);

export const startInstallEditor = (opts: {
  version: string;
  modules?: string[];
  architecture?: string;
  childModules?: boolean;
}) => invoke<ProcessHandle>("start_install_editor", opts);

export const cancelProcess = (id: number) => invoke("cancel_process", { id });
export const buildCommandString = (args: string[], json: boolean) =>
  invoke<string>("build_command_string", { args, json });
export const checkUnityAvailable = () => invoke<boolean>("check_unity_available");
export const getUnityPath = () => invoke<string>("get_unity_path");

// ─── MCP / Status / Pipeline ─────────────────────────────────────────────────

export const getStatus = (projectPath?: string) => invoke<EditorStatus[]>("get_status", { projectPath });
export const pipelineList = () => invoke<PipelineEntry[]>("pipeline_list");
export const pipelineListVersions = () => invoke<any>("pipeline_list_versions");
export const pipelineInstall = (projectPath?: string, force?: boolean) =>
  invoke("pipeline_install", { projectPath, force });
export const pipelineUpgrade = (projectPath?: string) =>
  invoke("pipeline_upgrade", { projectPath });
export const listEditorCommands = (projectPath?: string) =>
  invoke<any>("list_editor_commands", { projectPath });
export const executeEditorCommand = (opts: {
  command: string;
  args?: string[];
  projectPath?: string;
  timeout?: number;
}) => invoke<any>("execute_editor_command", opts);
export const listMcpClients = () => invoke<McpClientInfo[]>("list_mcp_clients");
export const configureMcpClient = (opts: {
  client: string;
  projectPath?: string;
  local?: boolean;
  dryRun?: boolean;
}) => invoke<string>("configure_mcp_client", opts);

// ─── Settings / Logs / Diagnostics ──────────────────────────────────────────

export const startLogStream = (opts: { follow?: boolean; level?: string; tail?: number }) =>
  invoke<ProcessHandle>("start_log_stream", opts);
export const runDoctor = () => invoke<string>("run_doctor");
export const runDiagnose = () => invoke<string>("run_diagnose");
export const authStatus = () => invoke<AuthInfo>("auth_status");
export const authLogin = () => invoke("auth_login");
export const authLogout = () => invoke("auth_logout");
export const licenseStatus = () => invoke<any>("license_status");
export const licenseActivate = (opts: { serial?: string; personal?: boolean; floating?: boolean; file?: string; acceptEula?: boolean }) =>
  invoke("license_activate", opts);
export const licenseReturn = () => invoke("license_return");
export const listLicenses = () => invoke<any>("list_licenses");
export const cloudStatus = () => invoke<any>("cloud_status");
export const listCloudOrgs = () => invoke<any>("list_cloud_orgs");
export const getLanguage = () => invoke<LanguageInfo>("get_language");
export const setLanguage = (code: string) => invoke("set_language", { code });
export const getProxy = () => invoke<ProxyInfo>("get_proxy");
export const setProxy = (url: string, bypass?: string) => invoke("set_proxy", { url, bypass });
export const unsetProxy = () => invoke("unset_proxy");
export const analyticsStatus = () => invoke<AnalyticsInfo>("analytics_status");
export const analyticsOptIn = () => invoke("analytics_opt_in");
export const analyticsOptOut = () => invoke("analytics_opt_out");
export const checkCliUpdate = () => invoke<UpgradeInfo>("check_cli_update");
export const getChangelog = () => invoke<string>("get_changelog");
export const getUpdateCheck = () => invoke<any>("get_update_check");
export const setUpdateCheck = (state: string) => invoke("set_update_check", { state });
export const startCliUpgrade = (yes?: boolean) => invoke<ProcessHandle>("start_cli_upgrade", { yes });
export const installHub = () => invoke("install_hub");
export const checkHubInstalled = () => invoke<{ installed: boolean; path: string }>("check_hub_installed");
export const selfUninstall = (purge?: boolean) => invoke("self_uninstall", { purge });

// ─── AI Chat ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: string;
  content: string;
}

export const aiChat = (opts: {
  gatewayUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}) => invoke<string>("ai_chat", opts);

export const aiTestConnection = (gatewayUrl: string, apiKey: string, model: string) =>
  invoke<string>("ai_test_connection", { gatewayUrl, apiKey, model });

export const getSystemLocale = () => invoke<string>("get_system_locale");
export const readFileContent = (path: string) => invoke<string>("read_file_content", { path });
export const writeFileContent = (path: string, content: string) => invoke("write_file_content", { path, content });

// ─── Execute arbitrary unity command ───────────────────────────────────────

export const runUnityCommand = (args: string[], json = true) => invoke<string>("run_unity_command", { args, json });
