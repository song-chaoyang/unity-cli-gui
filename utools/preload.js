/**
 * preload.js — uTools preload script (Node.js / CommonJS)
 *
 * Only 18 generic backend primitives — all command-specific arg construction
 * lives in src/lib/tauri.ts (single source of truth shared with Tauri).
 *
 * Exposes window.unityAPI = { invoke, listen, emit } which the frontend
 * shim modules (src/shims/*.ts) redirect @tauri-apps/* imports to.
 */

const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const readline = require("readline");

// ═══════════════════════════════════════════════════════════════════════════
//  Binary Discovery
// ═══════════════════════════════════════════════════════════════════════════

function commandExists(cmd) {
  try {
    const checkCmd = process.platform === "win32" ? "where" : "which";
    execFileSync(checkCmd, [cmd], { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
    return true;
  } catch { return false; }
}

function findUnityBinary() {
  if (commandExists("unity")) {
    try {
      const checkCmd = process.platform === "win32" ? "where" : "which";
      const result = execFileSync(checkCmd, ["unity"], { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      if (result) return result.split("\n")[0].trim();
    } catch {}
  }
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = process.platform === "win32"
    ? [path.join(home, ".unity", "bin", "unity.exe"), path.join(process.env.LOCALAPPDATA || "", "unity", "unity.exe")]
    : [path.join(home, ".unity", "bin", "unity"), path.join(home, ".local", "bin", "unity"), "/usr/local/bin/unity", "/usr/bin/unity"];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function requireUnity() {
  const binary = findUnityBinary();
  if (!binary) throw new Error("Unity CLI binary not found. Install it from https://unity.com or set the path in Settings.");
  return binary;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CLI Execution
// ═══════════════════════════════════════════════════════════════════════════

function runUnityJson(args) {
  return new Promise((resolve, reject) => {
    let binary;
    try { binary = requireUnity(); } catch (e) { reject(e); return; }
    const child = spawn(binary, ["--json", "--no-banner", ...args], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => stdout += d);
    child.stderr.on("data", d => stderr += d);
    child.on("close", code => {
      if (code !== 0) { reject(new Error(`unity ${args.join(" ")} exited with code ${code}\n${stderr}`)); return; }
      try {
        const resp = JSON.parse(stdout);
        if (!resp.success) { reject(new Error(resp.errors?.join("; ") || "Command failed")); return; }
        resolve(resp.data);
      } catch (e) { reject(new Error(`Failed to parse JSON: ${e.message}\n${stdout.slice(0, 500)}`)); }
    });
    child.on("error", err => reject(new Error(`Failed to spawn unity: ${err.message}`)));
  });
}

function runUnityPlain(args) {
  return new Promise((resolve, reject) => {
    let binary;
    try { binary = requireUnity(); } catch (e) { reject(e); return; }
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => stdout += d);
    child.stderr.on("data", d => stderr += d);
    child.on("close", code => {
      if (code !== 0) { reject(new Error(`unity ${args.join(" ")} exited with code ${code}\n${stderr}`)); return; }
      resolve(stdout);
    });
    child.on("error", err => reject(new Error(`Failed to spawn unity: ${err.message}`)));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Streaming Process Management
// ═══════════════════════════════════════════════════════════════════════════

const listeners = new Map();
const processes = new Map();
let nextProcessId = 0;

function emit(eventName, payload) {
  const handlers = listeners.get(eventName);
  if (handlers) for (const h of handlers) { try { h({ payload }); } catch (e) { console.error(`Listener error:`, e); } }
}

function spawnAndStream(prefix, child, cmdStr) {
  const id = nextProcessId++;
  processes.set(id, child);
  readline.createInterface({ input: child.stdout }).on("line", line => emit(`${prefix}-stdout`, { line }));
  readline.createInterface({ input: child.stderr }).on("line", line => emit(`${prefix}-stderr`, { line }));
  child.on("close", code => {
    if (child._cancelled) emit(`${prefix}-exit`, { code: -2, success: false, cancelled: true, command: cmdStr });
    else emit(`${prefix}-exit`, { code: code ?? -1, success: code === 0, command: cmdStr });
    processes.delete(id);
  });
  child.on("error", () => { emit(`${prefix}-exit`, { code: -1, success: false, command: cmdStr }); processes.delete(id); });
  return { id, command: cmdStr };
}

function startStreaming(prefix, args, includeJsonFlags) {
  const binary = requireUnity();
  const cmdArgs = includeJsonFlags ? ["--json", "--no-banner", ...args] : args;
  const child = spawn(binary, cmdArgs, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  return spawnAndStream(prefix, child, `unity ${cmdArgs.join(" ")}`);
}

function startRawStream(prefix, shellCmd) {
  const child = process.platform === "win32"
    ? spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", shellCmd], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true })
    : spawn("/bin/sh", ["-c", shellCmd], { stdio: ["ignore", "pipe", "pipe"] });
  return spawnAndStream(prefix, child, shellCmd);
}

function cancelProcess(id) {
  const child = processes.get(id);
  if (!child) throw new Error(`Process ${id} not found`);
  child._cancelled = true; child.kill("SIGTERM"); processes.delete(id);
}

// ═══════════════════════════════════════════════════════════════════════════
//  AI Chat (HTTP)
// ═══════════════════════════════════════════════════════════════════════════

function aiChat(gatewayUrl, apiKey, model, messages, maxTokens, temperature) {
  return new Promise((resolve, reject) => {
    const url = gatewayUrl.endsWith("/") ? `${gatewayUrl}v1/chat/completions` : `${gatewayUrl}/v1/chat/completions`;
    const body = JSON.stringify({ model, messages, ...(maxTokens != null && { max_tokens: maxTokens }), ...(temperature != null && { temperature }) });
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request({
      hostname: parsed.hostname, port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search, method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, res => {
      let data = ""; res.on("data", c => data += c);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) { reject(new Error(`AI gateway ${res.statusCode}: ${data.slice(0, 500)}`)); return; }
        try { resolve(JSON.parse(data).choices?.[0]?.message?.content || reject(new Error("AI returned no choices"))); }
        catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    });
    req.on("error", err => reject(new Error(`AI request failed: ${err.message}`)));
    req.write(body); req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Git Info
// ═══════════════════════════════════════════════════════════════════════════

function getGitInfo(projectPath) {
  return new Promise(resolve => {
    if (!fs.existsSync(path.join(projectPath, ".git"))) { resolve({ isGit: false }); return; }
    const { execFile } = require("child_process");
    let done = 0, branch = "", repoUrl = "", dirty = false;
    const check = () => { if (++done >= 3) resolve({ isGit: true, branch, repoUrl, dirty }); };
    execFile("git", ["-C", projectPath, "rev-parse", "--abbrev-ref", "HEAD"], (e, o) => { if (!e) branch = o.trim(); check(); });
    execFile("git", ["-C", projectPath, "remote", "get-url", "origin"], (e, o) => { if (!e) repoUrl = o.trim(); check(); });
    execFile("git", ["-C", projectPath, "status", "--porcelain"], (e, o) => { if (!e) dirty = o.length > 0; check(); });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  File I/O / OS / Hub / Meta / Locale
// ═══════════════════════════════════════════════════════════════════════════

function revealInFileManager(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Path not found: ${filePath}`);
  if (typeof utools !== "undefined" && utools.showItemInFolder) { utools.showItemInFolder(filePath); return; }
  if (process.platform === "darwin") spawn("open", ["-R", filePath], { detached: true, stdio: "ignore" }).unref();
  else if (process.platform === "win32") require("child_process").exec(`explorer.exe /select,"${filePath}"`);
  else spawn("xdg-open", [path.dirname(filePath)], { detached: true, stdio: "ignore" }).unref();
}

function openTerminalAtPath(dirPath) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) throw new Error(`Directory not found: ${dirPath}`);
  if (process.platform === "darwin") spawn("open", ["-a", "Terminal", dirPath], { detached: true, stdio: "ignore" }).unref();
  else if (process.platform === "win32") require("child_process").exec(`start cmd /K "cd /d ${dirPath}"`);
  else { for (const t of ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "xterm"]) { if (commandExists(t)) { spawn(t, ["--working-directory", dirPath], { detached: true, stdio: "ignore" }).unref(); return; } } throw new Error("No terminal found"); }
}

function openInEditor(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Path not found: ${filePath}`);
  for (const ed of ["code", "cursor", "zed"]) { if (commandExists(ed)) { spawn(ed, [filePath], { detached: true, stdio: "ignore" }).unref(); return; } }
  revealInFileManager(filePath);
}

function findHub() {
  const home = process.env.HOME || "";
  const candidates = process.platform === "darwin" ? ["/Applications/Unity Hub.app", `${home}/Applications/Unity Hub.app`]
    : process.platform === "win32" ? [path.join(process.env.ProgramFiles || "", "Unity Hub", "Unity Hub.exe"), path.join(process.env.LOCALAPPDATA || "", "Programs", "Unity Hub", "Unity Hub.exe")]
    : ["/usr/bin/unity-hub", "/usr/local/bin/unity-hub", "/opt/unity-hub/unity-hub", `${home}/.local/share/unity-hub/unity-hub`];
  for (const c of candidates) if (fs.existsSync(c)) return { installed: true, path: c };
  if (commandExists("unity-hub")) { try { return { installed: true, path: execFileSync("which", ["unity-hub"], { encoding: "utf-8" }).trim() }; } catch {} }
  return { installed: false, path: "" };
}

function metaFilePath() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const dir = home ? path.join(home, ".unity-gui") : ".unity-gui";
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return path.join(dir, "project-meta.json");
}

function getSystemLocale() {
  for (const v of ["LC_ALL", "LC_MESSAGES", "LANG"]) { const val = process.env[v]; if (val && val !== "C" && val !== "POSIX") return val; }
  return "en";
}

// ═══════════════════════════════════════════════════════════════════════════
//  Command Dispatch — only 18 generic commands
// ═══════════════════════════════════════════════════════════════════════════

const commands = {
  // Generic CLI execution
  run_unity_json: (args) => runUnityJson(args.args),
  run_unity_plain: (args) => runUnityPlain(args.args),
  start_streaming: (args) => Promise.resolve(startStreaming(args.prefix, args.args, args.includeJsonFlags)),
  start_raw_stream: (args) => Promise.resolve(startRawStream(args.prefix, args.shellCmd)),
  cancel_process: (args) => { cancelProcess(args.id); return Promise.resolve(); },
  check_unity_available: () => Promise.resolve(findUnityBinary() !== null),
  get_unity_path: () => { const b = findUnityBinary(); return b ? Promise.resolve(b) : Promise.reject(new Error("Unity CLI not found")); },
  // Platform-specific
  ai_chat: (args) => aiChat(args.gatewayUrl, args.apiKey, args.model, args.messages, args.maxTokens, args.temperature),
  get_git_info: (args) => getGitInfo(args.projectPath),
  read_file_content: (args) => fs.existsSync(args.path) ? Promise.resolve(fs.readFileSync(args.path, "utf-8")) : Promise.reject(new Error(`File not found: ${args.path}`)),
  write_file_content: (args) => { try { fs.mkdirSync(path.dirname(args.path), { recursive: true }); fs.writeFileSync(args.path, args.content); return Promise.resolve(); } catch (e) { return Promise.reject(new Error(`Failed to write: ${e.message}`)); } },
  reveal_in_file_manager: (args) => { revealInFileManager(args.path); return Promise.resolve(); },
  open_terminal_at_path: (args) => { openTerminalAtPath(args.path); return Promise.resolve(); },
  open_in_editor: (args) => { openInEditor(args.path); return Promise.resolve(); },
  check_hub_installed: () => Promise.resolve(findHub()),
  get_project_meta: (args) => { try { return Promise.resolve(JSON.parse(fs.readFileSync(metaFilePath(), "utf-8"))[args.projectPath] || {}); } catch { return Promise.resolve({}); } },
  set_project_meta: (args) => { try { const p = metaFilePath(); const m = JSON.parse(fs.readFileSync(p, "utf-8") || "{}"); m[args.projectPath] = args.meta; fs.writeFileSync(p, JSON.stringify(m, null, 2)); return Promise.resolve(); } catch (e) { return Promise.reject(new Error(`Failed: ${e.message}`)); } },
  get_system_locale: () => Promise.resolve(getSystemLocale()),
};

// ═══════════════════════════════════════════════════════════════════════════
//  Bridge
// ═══════════════════════════════════════════════════════════════════════════

window.unityAPI = {
  invoke: async (cmd, args) => {
    const fn = commands[cmd];
    if (!fn) throw new Error(`Unknown command: ${cmd}`);
    return fn(args || {});
  },
  listen: (eventName, handler) => {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(handler);
    return Promise.resolve(() => { const s = listeners.get(eventName); if (s) { s.delete(handler); if (s.size === 0) listeners.delete(eventName); } });
  },
  emit: (eventName, payload) => emit(eventName, payload),
};

if (typeof utools !== "undefined" && utools.onPluginEnter) {
  utools.onPluginEnter(() => { if (utools.setExpendHeight) utools.setExpendHeight(700); });
}
