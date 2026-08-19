/**
 * Unity CLI Web GUI — Node.js Server
 *
 * Zero npm dependencies. Uses only Node.js built-in modules.
 * Implements the same 18 generic primitives as the Rust Tauri backend.
 *
 * Usage:
 *   node web/server.mjs                          # serve production build from dist/
 *   PORT=9000 node web/server.mjs               # custom port
 *   UNITY_PATH=/usr/local/bin/unity node web/server.mjs  # override unity binary
 *   DEV=1 node web/server.mjs                   # proxy / to Vite dev server (port 1422)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const PORT = process.env.PORT || 8080;
const UNITY_PATH = process.env.UNITY_PATH || null;
const DEV = process.env.DEV === "1";

// ─── Process Management ──────────────────────────────────────────────────────

let nextProcessId = 0;
/** @type {Map<number, {child: import('child_process').ChildProcess, prefix: string}>} */
const runningProcesses = new Map();

// ─── SSE Clients ─────────────────────────────────────────────────────────────

/** @type {Set<import('http').ServerResponse>} */
const sseClients = new Set();

function sendSSE(event, payload) {
  const data = JSON.stringify({ event, payload });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Send keepalive every 15s to prevent connection timeout
setInterval(() => {
  for (const client of sseClients) {
    try { client.write(": keepalive\n\n"); } catch { sseClients.delete(client); }
  }
}, 15000);

// ─── Unity Binary Discovery ──────────────────────────────────────────────────

function findUnityBinary() {
  if (UNITY_PATH && fs.existsSync(UNITY_PATH)) return UNITY_PATH;

  // Check PATH
  try {
    const result = execSync("which unity", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    if (result) return result;
  } catch {}

  // Build candidate list: home dir + system locations + all /home/* users
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = process.platform === "win32"
    ? [`${home}\\.unity\\bin\\unity.exe`, `${process.env.LOCALAPPDATA || ""}\\unity\\unity.exe`]
    : [`${home}/.unity/bin/unity`, `${home}/.local/bin/unity`, "/usr/local/bin/unity", "/usr/bin/unity"];

  // Also scan /home/*/.unity/bin/unity for other users (e.g. systemd running as root
  // but unity installed under a regular user's home)
  if (process.platform !== "win32") {
    try {
      const homeDirs = fs.readdirSync("/home");
      for (const dir of homeDirs) {
        const p = `/home/${dir}/.unity/bin/unity`;
        if (!candidates.includes(p)) candidates.push(p);
      }
    } catch {}
    // Also check /root
    candidates.push("/root/.unity/bin/unity");
  }

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function requireUnity() {
  const p = findUnityBinary();
  if (!p) throw new Error("Unity CLI binary not found. Install it or set UNITY_PATH env var.");
  return p;
}

/** Find the Unity Editor binary (for manual license activation). */
function findUnityEditorBinary() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const editorBase = process.platform === "win32"
    ? `${home}\\Unity\\Hub\\Editor`
    : `${home}/Unity/Hub/Editor`;
  if (!fs.existsSync(editorBase)) return null;
  try {
    const versions = fs.readdirSync(editorBase);
    for (const v of versions) {
      const editorPath = process.platform === "win32"
        ? path.join(editorBase, v, "Editor", "Unity.exe")
        : path.join(editorBase, v, "Editor", "Unity");
      if (fs.existsSync(editorPath)) return editorPath;
    }
  } catch {}
  return null;
}

// ─── Unity CLI Execution ─────────────────────────────────────────────────────

/**
 * Internal: spawn unity with args, return {stdout, stderr, code}.
 * Includes a 30-second timeout to prevent hanging on Licensing Client connections.
 */
function runUnityRawInternal(binary, args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { child.kill("SIGKILL"); } catch {}
        resolve({ stdout, stderr: stderr + "\n(timeout after 30s)", code: -1 });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (err) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(new Error(`Failed to spawn unity: ${err.message}`)); }
    });
    child.on("close", (code) => {
      if (!settled) { settled = true; clearTimeout(timer); resolve({ stdout, stderr, code }); }
    });
  });
}

/**
 * Detect CLI format: 'new' (v1.0+ with global --json + envelope) or 'old' (v0.x with per-command --json, raw JSON).
 * Cached after first detection.
 */
let cliFormat = null;

async function detectCliFormat() {
  if (cliFormat !== null) return cliFormat;
  const binary = requireUnity();
  try {
    // Try new CLI: global --json --no-banner prefix
    const { stdout, code } = await runUnityRawInternal(binary, ["--json", "--no-banner", "editors", "--installed"]);
    // Even if exit code is non-zero (e.g. no Hub installed), the CLI may still
    // produce valid JSON with the {success, data, errors} envelope. Parse stdout
    // to determine format — don't rely on exit code alone.
    try {
      const parsed = JSON.parse(stdout);
      if (parsed && typeof parsed === "object" && "success" in parsed) {
        cliFormat = "new";
        return cliFormat;
      }
    } catch {}
    // stdout is not valid JSON envelope — if code was 0, it might be raw JSON (old CLI)
    if (code === 0) {
      cliFormat = "new";
      return cliFormat;
    }
  } catch {}
  // Global --json failed → old CLI (per-command --json suffix)
  cliFormat = "old";
  return cliFormat;
}

/** Unwrap {success, data, errors} envelope if present, otherwise return as-is. */
function unwrapEnvelope(parsed) {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "success" in parsed && "data" in parsed) {
    if (!parsed.success) {
      const msg = parsed.errors?.length ? parsed.errors.join("; ") : "Command reported failure";
      throw new Error(msg);
    }
    return parsed.data;
  }
  return parsed;
}

// ─── Old CLI (v0.x) Command Translation ──────────────────────────────────────
// The old CLI (v0.1.0, the latest available for linux-arm64) has different
// command syntax than the new CLI (v1.0+) that tauri.ts was written for.
// This function translates new-CLI args to old-CLI equivalents, or returns
// null to indicate the command doesn't exist (→ graceful empty result).

/**
 * Translate new-CLI args to old-CLI equivalents.
 * @param {string[]} args - new-CLI args (e.g. ["projects", "new", "test"])
 * @returns {string[]|null} old-CLI args, or null if command doesn't exist
 */
function translateOldCli(args) {
  const joined = args.join(" ");

  // ── projects: new → create ──
  // New: "projects new <name>"  →  Old: "projects create <name>"
  if (joined.startsWith("projects new ")) {
    return joined.replace("projects new ", "projects create ").split(" ");
  }

  // ── projects: list -a → list (no -a on old CLI) ──
  // Already handled by auto-strip, but be explicit
  if (joined === "projects list -a" || joined === "projects list --all") {
    return ["projects", "list"];
  }

  // ── editors: module add → install-modules ──
  // New: "editors module add <version> --module <mods> [--architecture <arch>] [--accept-eula] [--yes]"
  // Old: "install-modules -e <version> -m <mods> [--architecture <arch>]"
  if (joined.startsWith("editors module add ")) {
    const rest = args.slice(3); // after "editors module add"
    const version = rest[0];
    const newArgs = ["install-modules", "-e", version];
    let i = 1;
    while (i < rest.length) {
      if (rest[i] === "--module" && rest[i + 1] !== undefined) {
        newArgs.push("-m", rest[i + 1]); i += 2; continue;
      }
      if (rest[i] === "--architecture" && rest[i + 1] !== undefined) {
        newArgs.push("--architecture", rest[i + 1]); i += 2; continue;
      }
      // Skip --accept-eula, --yes, --childModules (not supported by old CLI im)
      if (["--accept-eula", "--yes", "--childModules", "--child-modules"].includes(rest[i])) { i++; continue; }
      i++;
    }
    return newArgs;
  }

  // ── editors: module remove → uninstall-modules (not available on old CLI) ──
  // Old CLI's install-modules has no remove subcommand. Return null → graceful empty.
  if (joined.startsWith("editors module remove ")) {
    return null; // Not supported on old CLI
  }

  // ── editors: module refresh → same on v1.0+ (no translation needed) ──
  // Old CLI didn't have "editors module refresh", so this only runs if CLI is old.
  // On v1.0+ the command works directly and never reaches translateOldCli.
  // On old CLI, try install-modules -l as a best effort.
  if (joined.startsWith("editors module refresh ")) {
    const version = args[3];
    return ["install-modules", "-e", version, "-l"];
  }

  // ── editors module list → same on v1.0+ (no translation needed) ──
  // Old CLI didn't have "editors module list", try install-modules -l.
  if (joined.startsWith("editors module list ")) {
    const version = args[3];
    return ["install-modules", "-e", version, "-l"];
  }

  // ── modules list → editors module list (v1.0+) or install-modules -l (v0.x) ──
  // NOTE: This is the OLD form from tauri.ts. On v1.0+ CLI, "modules list" fails
  // with "editor not installed". The correct command is "editors module list".
  // Since tauri.ts now uses "editors module list" directly, this old translation
  // is only hit if something calls the old "modules list" form.
  if (joined.startsWith("modules list ")) {
    const version = args[2];
    return ["editors", "module", "list", version];
  }

  // ── releases → editors --releases ──
  // New: "releases" or "releases --lts" or "releases --stream <s>"
  // Old: "editors --releases" (no --lts, --stream, --since, --limit on old CLI)
  if (joined === "releases" || joined.startsWith("releases ")) {
    // Strip unsupported options, keep --releases
    return ["editors", "--releases"];
  }

  // ── editors: install-path → install-path ──
  // New: "editors install-path" or "editors install-path --set <path>"
  // Old: "install-path --get" or "install-path --set <path>" (or -s)
  if (joined.startsWith("editors install-path")) {
    let rest = args.slice(2);
    const hasSet = rest.includes("--set");
    rest = rest.map(a => a === "--set" ? "-s" : a);
    if (!hasSet) {
      // No --set → getting current path, need --get
      rest.push("--get");
    }
    return ["install-path", ...rest];
  }

  // ── editors: upgrade → not available on old CLI ──
  // Old CLI's "upgrade" is for upgrading the CLI itself, not editors
  if (joined.startsWith("editors upgrade")) {
    return null; // Not supported on old CLI
  }

  // ── editors: running → not available on old CLI ──
  if (joined === "editors running") {
    return null; // Not supported on old CLI
  }

  // ── editors: info → not available as subcommand ──
  // New: "editors info <version>"  →  Old: editors --installed --verbose (filter by version)
  if (joined.startsWith("editors info ")) {
    // Old CLI doesn't have "editors info", just return from installed list
    return null; // Handled by graceful fallback
  }

  // ── editors: path → not available on old CLI ──
  if (joined.startsWith("editors path ")) {
    return null;
  }

  // ── cache: not available on old CLI ──
  if (joined.startsWith("cache ")) {
    return null;
  }

  // ── env: not available on old CLI ──
  if (joined === "env") {
    return null;
  }

  // ── status: not available on old CLI ──
  if (joined.startsWith("status")) {
    return null;
  }

  // ── pipeline: not available on old CLI ──
  if (joined.startsWith("pipeline ")) {
    return null;
  }

  // ── mcp: not available on old CLI ──
  if (joined.startsWith("mcp ")) {
    return null;
  }

  // ── cloud: not available on old CLI ──
  if (joined.startsWith("cloud ")) {
    return null;
  }

  // ── license: not available on old CLI ──
  if (joined.startsWith("license ")) {
    return null;
  }

  // ── analytics: not available on old CLI ──
  if (joined.startsWith("analytics ")) {
    return null;
  }

  // ── templates: not available on old CLI ──
  if (joined.startsWith("templates ")) {
    return null;
  }

  // ── bug: not available on old CLI ──
  if (joined.startsWith("bug ")) {
    return null;
  }

  // ── hub: not available on old CLI ──
  if (joined.startsWith("hub ")) {
    return null;
  }

  // ── self-uninstall → implode ──
  // New: "self-uninstall --yes" or "self-uninstall --yes --purge"
  // Old: "implode" (no --yes needed, it's non-interactive)
  if (joined.startsWith("self-uninstall")) {
    const newArgs = ["implode"];
    if (args.includes("--purge")) newArgs.push("--purge");
    return newArgs;
  }

  // ── config: proxy → not available on old CLI ──
  if (joined.startsWith("config ")) {
    return null;
  }

  // ── upgrade: --check → --check (same on old CLI) ──
  // ── changelog → same on old CLI ──
  // ── doctor → not available on old CLI ──
  if (joined === "doctor") {
    return null;
  }
  if (joined === "diagnose") {
    return null;
  }

  // ── list: → not available on old CLI ──
  if (joined.startsWith("list")) {
    return null;
  }

  // ── command: → not available on old CLI ──
  if (joined.startsWith("command ")) {
    return null;
  }

  // ── projects: pin/unpin/upgrade/size/clone/link/unlink/export/import → not available ──
  if (joined.startsWith("projects pin ") || joined.startsWith("projects unpin ") ||
      joined.startsWith("projects upgrade ") || joined.startsWith("projects size") ||
      joined.startsWith("projects clone ") || joined.startsWith("projects link ") ||
      joined.startsWith("projects unlink ") || joined.startsWith("projects export") ||
      joined.startsWith("projects import ")) {
    return null;
  }

  // ── install: add --yes --accept-eula → install (no --yes, no --accept-eula on old CLI) ──
  // New: "install <version> --yes --accept-eula --module <mods>"
  // Old: "install <version> -m <mods>" (no --yes, no --accept-eula)
  // NOTE: This is a streaming command, handled separately in startStreaming

  // ── uninstall: add --yes → uninstall (no --yes on old CLI) ──
  // New: "uninstall <version> --yes"
  // Old: "uninstall <version>" (no --yes)

  // Default: no translation needed (e.g. editors --installed, projects list, etc.)
  return args;
}

/**
 * For commands that don't exist on old CLI, return graceful empty results
 * instead of errors. This prevents the UI from showing error toasts.
 */
function gracefulEmptyResult(args) {
  const joined = args.join(" ");

  // env → return empty env info
  if (joined === "env") {
    return { userDataPath: "", editorInstallPath: "", downloadCachePath: "", configPath: "", hubVersion: "" };
  }

  // cache info → empty cache
  if (joined === "cache info") {
    return { path: "", sizeBytes: 0, size: "0 B", fileCount: 0, unreadable: false };
  }

  // editors running → empty array
  if (joined === "editors running") {
    return []; // Frontend wraps in instances
  }

  // status → empty array
  if (joined.startsWith("status")) {
    return [];
  }

  // pipeline * → empty/null
  if (joined.startsWith("pipeline ")) {
    if (joined.includes("list")) return []; // Frontend wraps in instances
    return null;
  }

  // mcp * → empty array
  if (joined.startsWith("mcp ")) {
    return [];
  }

  // cloud * → empty
  if (joined.startsWith("cloud ")) {
    return [];
  }

  // license status → empty (read-only, safe to return empty)
  if (joined === "license status" || joined === "license list" || joined.startsWith("license server")) {
    return [];
  }

  // license activate/return → NOT supported on old CLI, throw clear error
  if (joined.startsWith("license activate") || joined.startsWith("license return")) {
    return null; // null = let it throw "not available"
  }

  // analytics * → optedIn false
  if (joined.startsWith("analytics ")) {
    return { optedIn: false };
  }

  // templates * → empty array
  if (joined.startsWith("templates ")) {
    return [];
  }

  // bug * → success
  if (joined.startsWith("bug ")) {
    return { success: true, message: "Bug report feature not available on this CLI version" };
  }

  // hub * → not installed
  if (joined.startsWith("hub ")) {
    return { installed: false };
  }

  // config * → empty
  if (joined.startsWith("config ")) {
    return {};
  }

  // editors upgrade --check → no upgrades
  if (joined.startsWith("editors upgrade")) {
    return [];
  }

  // editors info → null
  if (joined.startsWith("editors info ")) {
    return null;
  }

  // editors path → empty
  if (joined.startsWith("editors path ")) {
    return "";
  }

  // projects pin/unpin → success
  if (joined.startsWith("projects pin ") || joined.startsWith("projects unpin ")) {
    return { success: true };
  }

  // projects upgrade → success
  if (joined.startsWith("projects upgrade ")) {
    return { success: true, message: "Project upgrade not available on this CLI version" };
  }

  // projects size → empty
  if (joined.startsWith("projects size")) {
    return [];
  }

  // projects clone/link/unlink/export/import → not available
  if (joined.startsWith("projects clone ") || joined.startsWith("projects link ") ||
      joined.startsWith("projects unlink ") || joined.startsWith("projects export") ||
      joined.startsWith("projects import ")) {
    return { success: false, message: "This feature is not available on CLI v0.1.0" };
  }

  // list → empty
  if (joined.startsWith("list")) {
    return [];
  }

  // command → empty
  if (joined.startsWith("command ")) {
    return [];
  }

  // doctor / diagnose → empty
  if (joined === "doctor" || joined === "diagnose") {
    return "";
  }

  return null; // Not a graceful-empty case, let the error through
}

/**
 * Run a unity command with JSON output. Auto-detects CLI format:
 * - New CLI (v1.0+): `unity --json --no-banner <args>` → envelope {success, data, errors}
 * - Old CLI (v0.x): `unity <args> --json` → raw JSON (no envelope)
 * Also retries by stripping unknown options (e.g. -a flag not supported on old CLI).
 * @returns {Promise<any>} the data (new) or raw JSON (old)
 */
async function runUnityJson(args) {
  const format = await detectCliFormat();
  const binary = requireUnity();

  if (format === "new") {
    return runUnityJsonNew(binary, args);
  }

  // Old CLI format cached — but CLI may have been upgraded to v1.0+.
  // Try old format first (translated + --json suffix), but if it fails,
  // fall back to new format (prefix --json --no-banner).
  try {
    return await runUnityJsonOld(binary, args);
  } catch (oldErr) {
    // If the old format failed, try new format as fallback
    try {
      return await runUnityJsonNew(binary, args);
    } catch {
      // Both failed — return the original old error
      throw oldErr;
    }
  }
}

/** Run with new CLI format: --json --no-banner prefix, envelope {success, data, errors} */
async function runUnityJsonNew(binary, args) {
  const { stdout, stderr, code } = await runUnityRawInternal(binary, ["--json", "--no-banner", ...args]);
  
  // CRITICAL: CLI may exit non-zero even when JSON output has success:true
  // (e.g. auth status exits code 3 when session expired, but JSON is valid).
  // Always try to parse stdout as JSON first, regardless of exit code.
  try {
    const resp = JSON.parse(stdout);
    if (resp && typeof resp === "object" && "success" in resp) {
      if (resp.success) {
        // Exit code was non-zero but JSON says success — CLI uses exit code
        // as a secondary signal (e.g. code 3 = session expired). Trust the JSON.
        return resp.data;
      }
      // success:false — check for environment-dependent failures
      const errCode = resp.errors?.[0]?.code || "";
      if (errCode === "LICENSING_CLIENT_UNAVAILABLE" || code === 6) {
        const graceful = gracefulEnvResult(args);
        if (graceful !== null) return graceful;
      }
      // For auth status specifically, return the data even on failure —
      // the frontend uses loggedIn field to determine state
      if (args.join(" ").startsWith("auth status") && resp.data) {
        return resp.data;
      }
      const errMsg = resp.errors?.length ? resp.errors.map(e => e.message).join("; ") : "Command reported failure";
      const graceful = gracefulEnvResult(args);
      if (graceful !== null) return graceful;
      throw new Error(errMsg);
    }
    // Raw JSON without envelope
    return resp;
  } catch (parseErr) {
    // JSON parse failed — not valid JSON output
    if (code === -1 && stderr.includes("timeout")) {
      const graceful = gracefulEnvResult(args);
      if (graceful !== null) return graceful;
    }
    const graceful = gracefulEnvResult(args);
    if (graceful !== null) return graceful;
    throw new Error(`unity ${args.join(" ")} exited with code ${code}\n${stderr}`);
  }
}

/** Run with old CLI format: --json suffix, raw JSON (no envelope) */
async function runUnityJsonOld(binary, args) {
  const translated = translateOldCli(args);
  if (translated === null) {
    // Command doesn't exist on old CLI — throw to trigger new-format fallback
    throw new Error("old-cli-not-supported");
  }

  let currentArgs = [...translated];
  for (let attempt = 0; attempt < 6; attempt++) {
    const { stdout, stderr, code } = await runUnityRawInternal(binary, [...currentArgs, "--json"]);
    if (code !== 0) {
      // Before throwing, try to parse stdout as JSON — the CLI may return
      // valid JSON with success:true even on non-zero exit codes (e.g.
      // `auth status` exits code 3 when session expired but JSON is valid).
      try {
        const parsed = JSON.parse(stdout);
        if (parsed && typeof parsed === "object" && "success" in parsed) {
          if (parsed.success) return unwrapEnvelope(parsed);
          // success:false — for auth status, return data so frontend can
          // check loggedIn field
          if (currentArgs.join(" ").startsWith("auth status") && parsed.data) {
            return parsed.data;
          }
        }
      } catch {}
      // JSON parse failed or success:false — check for unknown option to retry
      const optMatch = stderr.match(/unknown option '([^']+)'/);
      if (optMatch) {
        const opt = optMatch[1];
        if (opt === "--json") {
          const { stdout: plainOut, stderr: plainErr, code: plainCode } = await runUnityRawInternal(binary, currentArgs);
          if (plainCode !== 0) {
            throw new Error(`unity ${currentArgs.join(" ")} exited with code ${plainCode}\n${plainErr}`);
          }
          try { return JSON.parse(plainOut); } catch { return plainOut.trim(); }
        }
        currentArgs = currentArgs.filter(a => a !== opt);
        continue;
      }
      throw new Error(`unity ${currentArgs.join(" ")} exited with code ${code}\n${stderr}`);
    }
    try {
      const parsed = JSON.parse(stdout);
      return unwrapEnvelope(parsed);
    } catch {
      return stdout.trim();
    }
  }
  throw new Error("Too many unknown options after retries");
}

/** Return graceful empty result for commands that fail due to environment (no Licensing Client, no Pipeline, etc.) */
function gracefulEnvResult(args) {
  const joined = args.join(" ");
  if (joined.startsWith("license status")) {
    return { active: false, licenses: [] };
  }
  if (joined.startsWith("license list")) {
    return [];
  }
  if (joined.startsWith("license server")) {
    return { servers: [], status: "unknown" };
  }
  if (joined.startsWith("status")) {
    return [];
  }
  if (joined.startsWith("list")) {
    return [];
  }
  // NOTE: modules/editors module should NOT return empty — they work on v1.0+
  if (joined.startsWith("editors upgrade")) {
    return [];
  }
  if (joined.startsWith("templates list") || joined.startsWith("templates")) {
    return [];
  }
  if (joined.startsWith("bug ")) {
    return { success: true, message: "Bug report feature not available in this environment" };
  }
  return null;
}

/**
 * Run `unity <args>`, return raw stdout as string.
 */
async function runUnityPlain(args) {
  const format = await detectCliFormat();
  const binary = requireUnity();

  if (format === "old") {
    // Try old format first, fall back to new format if it fails
    try {
      const translated = translateOldCli(args);
      if (translated === null) throw new Error("old-cli-not-supported");
      const cleanArgs = translated.filter(a => a !== "--yes");
      const { stdout } = await runUnityRawInternal(binary, cleanArgs);
      return stdout;
    } catch {
      // Fallback: try new format (no --json, just run directly)
      const { stdout } = await runUnityRawInternal(binary, args);
      return stdout;
    }
  }

  // Return stdout regardless of exit code — the CLI uses exit codes as
  // secondary signals (e.g. `auth status` exits 3 when session expired
  // but still prints valid output to stdout).
  const { stdout } = await runUnityRawInternal(binary, args);
  return stdout;
}

// ─── Streaming Process Management ───────────────────────────────────────────

function spawnAndStream(prefix, command, args) {
  const id = nextProcessId++;
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

  runningProcesses.set(id, { child, prefix });

  // Stream stdout
  let stdoutBuf = "";
  child.stdout?.on("data", (chunk) => {
    stdoutBuf += chunk;
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop(); // keep last partial line
    for (const line of lines) {
      if (line) sendSSE(`${prefix}-stdout`, { line });
    }
  });

  // Stream stderr
  let stderrBuf = "";
  child.stderr?.on("data", (chunk) => {
    stderrBuf += chunk;
    const lines = stderrBuf.split("\n");
    stderrBuf = lines.pop();
    for (const line of lines) {
      if (line) sendSSE(`${prefix}-stderr`, { line });
    }
  });

  // Handle exit
  child.on("close", (code) => {
    // Flush remaining buffered lines
    if (stdoutBuf) sendSSE(`${prefix}-stdout`, { line: stdoutBuf });
    if (stderrBuf) sendSSE(`${prefix}-stderr`, { line: stderrBuf });

    const success = code === 0;
    sendSSE(`${prefix}-exit`, { code: code ?? -1, success, command: `${command} ${args.join(" ")}` });
    runningProcesses.delete(id);
  });

  child.on("error", (err) => {
    sendSSE(`${prefix}-stderr`, { line: `Failed to spawn: ${err.message}` });
    sendSSE(`${prefix}-exit`, { code: -1, success: false, command: `${command} ${args.join(" ")}` });
    runningProcesses.delete(id);
  });

  return { id, command: `${command} ${args.join(" ")}` };
}

async function startStreaming(prefix, args, includeJsonFlags) {
  const binary = requireUnity();
  const format = await detectCliFormat();
  let fullArgs = args;

  if (format === "old") {
    // Try old format translation, but if it returns null, use new format directly
    // (CLI may have been upgraded to v1.0+ after server start)
    const translated = translateOldCli(args);
    if (translated !== null) {
      fullArgs = translated.filter(a => a !== "--yes" && a !== "--accept-eula");
      if (includeJsonFlags) {
        fullArgs = [...fullArgs, "--json"];
      }
    } else {
      // CLI was likely upgraded — use new format
      if (includeJsonFlags) {
        fullArgs = ["--json", "--no-banner", ...args];
      }
    }
  } else {
    if (includeJsonFlags) {
      fullArgs = ["--json", "--no-banner", ...args];
    }
  }
  return spawnAndStream(prefix, binary, fullArgs);
}

function startRawStream(prefix, shellCmd) {
  // On all platforms, use /bin/sh -c
  return spawnAndStream(prefix, "/bin/sh", ["-c", shellCmd]);
}

function cancelProcess(id) {
  const entry = runningProcesses.get(id);
  if (!entry) throw new Error(`Process ${id} not found or already finished`);
  try { entry.child.kill("SIGTERM"); } catch {}
  runningProcesses.delete(id);
  // Send a cancelled exit event
  sendSSE(`${entry.prefix}-exit`, { code: -2, success: false, cancelled: true, command: entry.prefix });
}

// ─── Platform-Specific Handlers ──────────────────────────────────────────────

function getGitInfo(projectPath) {
  const p = path.resolve(projectPath);
  if (!fs.existsSync(p) || !fs.existsSync(path.join(p, ".git"))) {
    return { isGit: false };
  }

  const run = (args) => {
    try {
      return execSync(`git ${args}`, { cwd: p, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    } catch { return ""; }
  };

  const isDirty = (() => {
    try {
      const out = execSync("git status --porcelain", { cwd: p, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      return out.trim().length > 0;
    } catch { return false; }
  })();

  return {
    isGit: true,
    branch: run("rev-parse --abbrev-ref HEAD"),
    repoUrl: run("remote get-url origin"),
    dirty: isDirty,
  };
}

function checkHubInstalled() {
  const home = process.env.HOME || "";
  const candidates = process.platform === "win32"
    ? [`${process.env.ProgramFiles || ""}\\Unity Hub\\Unity Hub.exe`, `${process.env.LOCALAPPDATA || ""}\\Programs\\Unity Hub\\Unity Hub.exe`]
    : process.platform === "darwin"
      ? ["/Applications/Unity Hub.app", `${home}/Applications/Unity Hub.app`]
      : ["/usr/bin/unity-hub", "/usr/local/bin/unity-hub", "/opt/unity-hub/unity-hub", `${home}/.local/share/unity-hub/unity-hub`, `${home}/Unity Hub/unity-hub`, "/snap/unity-hub/current/bin/unity-hub"];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return { installed: true, path: c };
  }
  // Check PATH
  try {
    execSync("which unity-hub", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    return { installed: true, path: execSync("which unity-hub", { encoding: "utf8" }).trim() };
  } catch {}
  return { installed: false, path: "" };
}

// ─── Project Meta (local JSON persistence) ───────────────────────────────────

function metaFilePath() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const dir = home ? path.join(home, ".unity-gui") : path.join(process.cwd(), ".unity-gui");
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return path.join(dir, "project-meta.json");
}

function getProjectMeta(projectPath) {
  try {
    const content = fs.readFileSync(metaFilePath(), "utf8");
    const map = JSON.parse(content);
    return map[projectPath] || {};
  } catch { return {}; }
}

function setProjectMeta(projectPath, meta) {
  const filePath = metaFilePath();
  let map = {};
  try {
    map = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {}
  map[projectPath] = meta;
  fs.writeFileSync(filePath, JSON.stringify(map, null, 2));
}

// ─── System Locale ───────────────────────────────────────────────────────────

function getSystemLocale() {
  for (const v of ["LC_ALL", "LC_MESSAGES", "LANG"]) {
    const val = process.env[v];
    if (val && val !== "C" && val !== "POSIX") return val;
  }
  return "en";
}

// ─── AI Chat (HTTP gateway) ───────────────────────────────────────────────────

async function aiChat(opts) {
  const url = opts.gatewayUrl.endsWith("/")
    ? `${opts.gatewayUrl}v1/chat/completions`
    : `${opts.gatewayUrl}/v1/chat/completions`;

  const body = {
    model: opts.model,
    messages: opts.messages,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI gateway returned ${resp.status}: ${text.slice(0, 500)}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned no choices");
  return content;
}

// ─── Directory Listing (for file browser) ───────────────────────────────────

function listDirectory(dirPath) {
  const resolved = path.resolve(dirPath || "/");
  if (!fs.existsSync(resolved)) throw new Error(`Path not found: ${resolved}`);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${resolved}`);

  // Use readdirSync without withFileTypes to avoid Dirent serialization issues
  const names = fs.readdirSync(resolved);
  const result = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    let isDir = false;
    let size = 0;
    try {
      const s = fs.statSync(path.join(resolved, name));
      isDir = s.isDirectory();
      size = s.size;
    } catch {}
    result.push({ name, isDir, size });
  }
  result.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { path: resolved, entries: result };
}

// ─── Auth Login (extract URL from stdout + log for headless servers) ──────────

async function startAuthLogin() {
  const binary = requireUnity();

  // Determine log file path
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const logFile = path.join(home, ".config", "unityhub", "logs", "info-log.json");

  // Record the number of lines in the log before starting, so we only read new entries
  let prevLineCount = 0;
  try {
    const content = fs.readFileSync(logFile, "utf8");
    prevLineCount = content.split("\n").length;
  } catch {}

  // Start unity auth login and capture stdout (NOT detached — we kill it after extracting URL)
  const child = spawn(binary, ["auth", "login"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Collect stdout — CLI v1.0+ prints the auth URL directly to stdout
  let stdoutData = "";

  // Wait for the auth URL to appear — check BOTH stdout and log file (up to 15 seconds)
  const authUrl = await new Promise((resolve) => {
    const deadline = Date.now() + 15000;

    // Check stdout for URL (CLI prints "Sign-in URL:\n  https://...")
    child.stdout?.on("data", (chunk) => {
      stdoutData += chunk.toString();
      // Look for URL in stdout — CLI prints it as plain text
      const urlMatch = stdoutData.match(/https:\/\/services\.api\.unity\.com\/app-linking\/v1\/login\/redirect\/[^\s]+/);
      if (urlMatch) {
        resolve(urlMatch[0]);
        return;
      }
    });

    // Also poll the log file (older CLI versions write URL there)
    const check = () => {
      // Check stdout first
      const urlMatch = stdoutData.match(/https:\/\/services\.api\.unity\.com\/app-linking\/v1\/login\/redirect\/[^\s]+/);
      if (urlMatch) {
        resolve(urlMatch[0]);
        return;
      }

      // Check log file
      try {
        const content = fs.readFileSync(logFile, "utf8");
        const lines = content.split("\n");
        const newLines = lines.slice(prevLineCount);
        for (const line of newLines) {
          const m = line.match(/url: '([^']+)'/);
          if (m && m[1].includes("login/redirect")) {
            resolve(m[1]);
            return;
          }
        }
      } catch {}

      if (Date.now() < deadline) {
        setTimeout(check, 500);
      } else {
        resolve(null);
      }
    };
    setTimeout(check, 500);
  });

  // Kill the auth login process — we only needed it to get the URL.
  // The CLI's cloud polling continues server-side; keeping the process
  // alive wastes memory and causes OOM kills.
  try { child.kill("SIGTERM"); } catch {}
  try { child.kill("SIGKILL"); } catch {}

  return { authUrl };
}

// ─── Command Router ──────────────────────────────────────────────────────────

const commandHandlers = {
  // Generic CLI execution
  run_unity_json: (args) => runUnityJson(args.args),
  run_unity_plain: (args) => runUnityPlain(args.args),
  start_streaming: (args) => startStreaming(args.prefix, args.args, args.includeJsonFlags),
  start_raw_stream: (args) => startRawStream(args.prefix, args.shellCmd),
  cancel_process: (args) => { cancelProcess(args.id); return null; },
  check_unity_available: () => findUnityBinary() !== null,
  get_unity_path: () => requireUnity(),

  // AI Chat
  ai_chat: (args) => aiChat(args),

  // Git info
  get_git_info: (args) => getGitInfo(args.projectPath),

  // File I/O
  read_file_content: (args) => {
    if (!fs.existsSync(args.path)) throw new Error(`File not found: ${args.path}`);
    return fs.readFileSync(args.path, "utf8");
  },
  write_file_content: (args) => {
    const dir = path.dirname(args.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(args.path, args.content);
    return null;
  },

  // OS interactions (noop on headless)
  reveal_in_file_manager: (args) => {
    // Headless server — can't open file manager, return info
    if (!fs.existsSync(args.path)) throw new Error(`Path not found: ${args.path}`);
    return { message: "File manager not available on headless server", path: args.path };
  },
  open_terminal_at_path: (args) => {
    if (!fs.existsSync(args.path) || !fs.statSync(args.path).isDirectory()) {
      throw new Error(`Directory not found: ${args.path}`);
    }
    return { message: "Terminal not available on headless server", path: args.path };
  },
  open_in_editor: (args) => {
    if (!fs.existsSync(args.path)) throw new Error(`Path not found: ${args.path}`);
    return { message: "Code editor not available on headless server", path: args.path };
  },

  // Hub detection
  check_hub_installed: () => checkHubInstalled(),

  // Project meta
  get_project_meta: (args) => getProjectMeta(args.projectPath),
  set_project_meta: (args) => { setProjectMeta(args.projectPath, args.meta); return null; },

  // System locale
  get_system_locale: () => getSystemLocale(),

  // Server-side file browser (web mode only)
  list_directory: (args) => listDirectory(args.path),
  get_home_dir: () => process.env.HOME || process.env.USERPROFILE || "/",
  create_directory: (args) => { fs.mkdirSync(args.path, { recursive: true }); return null; },
  delete_path: (args) => {
    const resolved = path.resolve(args.path);
    if (!resolved.startsWith(process.env.HOME || "/")) throw new Error("Cannot delete paths outside home directory");
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) { fs.rmSync(resolved, { recursive: true }); }
    else { fs.unlinkSync(resolved); }
    return null;
  },
  rename_path: (args) => { fs.renameSync(args.from, args.to); return null; },

  // Auth login — start `unity auth login` in background, extract URL from log
  start_auth_login: async () => startAuthLogin(),

  // License manual activation — generate .alf request file via Unity Editor
  generate_license_request: async () => {
    const editorPath = findUnityEditorBinary();
    if (!editorPath) throw new Error("No Unity Editor installed");
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const result = await runUnityRawInternal(editorPath, [
      "-batchmode", "-nographics", "-createManualActivationFile", "-quit"
    ], 120000);
    // Find the .alf file
    const files = fs.readdirSync(home).filter(f => f.endsWith(".alf"));
    if (files.length === 0) throw new Error("Failed to generate activation file");
    const alfPath = path.join(home, files[files.length - 1]);
    const alfContent = fs.readFileSync(alfPath, "utf8");
    return { fileName: path.basename(alfPath), content: alfContent };
  },

  // License manual activation — activate with .ulf file via Unity Editor
  activate_license_file: async (args) => {
    const editorPath = findUnityEditorBinary();
    if (!editorPath) throw new Error("No Unity Editor installed");
    const ulfPath = args.path;
    if (!fs.existsSync(ulfPath)) throw new Error(`License file not found: ${ulfPath}`);
    const result = await runUnityRawInternal(editorPath, [
      "-batchmode", "-nographics", "-manualLicenseFile", ulfPath, "-quit"
    ], 120000);
    return { success: result.code === 0, stdout: result.stdout.slice(-500) };
  },
};

// ─── HTTP Request Handlers ───────────────────────────────────────────────────

async function handleInvoke(req, res) {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", async () => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      const { cmd, args } = JSON.parse(body);
      const handler = commandHandlers[cmd];
      if (!handler) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Unknown command: ${cmd}` }));
        return;
      }
      const result = await handler(args || {});
      res.writeHead(200);
      res.end(JSON.stringify(result ?? null));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

function handleSSE(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(": connected\n\n");
  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
    // If no more SSE clients, kill all running streaming processes
    // to prevent zombie processes accumulating and OOM kills
    if (sseClients.size === 0) {
      for (const [id, entry] of runningProcesses) {
        try { entry.child.kill("SIGTERM"); } catch {}
        try { entry.child.kill("SIGKILL"); } catch {}
        runningProcesses.delete(id);
      }
    }
  });
}

// ─── Static File Serving ─────────────────────────────────────────────────────

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

function serveStatic(req, res, url) {
  // In DEV mode, proxy to Vite dev server
  if (DEV) {
    return proxyToVite(req, res, url);
  }

  let filePath = path.join(distDir, url.pathname === "/" ? "index.html" : url.pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  // SPA fallback: if file doesn't exist, serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, "index.html");
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function proxyToVite(req, res, url) {
  const options = {
    hostname: "127.0.0.1",
    port: 1422,
    path: url.pathname + url.search,
    method: req.method,
    headers: req.headers,
  };

  const proxy = http.request(options, (viteRes) => {
    res.writeHead(viteRes.statusCode, viteRes.headers);
    viteRes.pipe(res);
  });

  proxy.on("error", () => {
    res.writeHead(502);
    res.end("Vite dev server not running. Start it with: pnpm dev:web");
  });

  req.pipe(proxy);
}

// ─── Server ──────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/invoke" && req.method === "POST") {
    return handleInvoke(req, res);
  }

  if (url.pathname === "/api/events" && req.method === "GET") {
    return handleSSE(req, res);
  }

  if (url.pathname.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  return serveStatic(req, res, url);
});

server.listen(PORT, "0.0.0.0", () => {
  const unityPath = findUnityBinary();
  const pad = (s, n) => (s.length > n ? s.slice(0, n) : s + " ".repeat(n - s.length));
  const w = 54;
  console.log("");
  console.log(`  ${"┌" + "─".repeat(w) + "┐"}`);
  console.log(`  ${"│"}  Unity CLI Web GUI${" ".repeat(w - 18)}${"│"}`);
  console.log(`  ${"├" + "─".repeat(w) + "┤"}`);
  console.log(`  ${"│"}  Server:  ${pad(`http://0.0.0.0:${PORT}`, w - 10)}${"│"}`);
  console.log(`  ${"│"}  Unity:   ${pad(unityPath || "NOT FOUND", w - 10)}${"│"}`);
  console.log(`  ${"│"}  Mode:    ${pad(DEV ? "DEV (proxy to Vite:1422)" : "PRODUCTION (serving dist/)", w - 10)}${"│"}`);
  console.log(`  ${"└" + "─".repeat(w) + "┘"}`);
  console.log("");

  if (!unityPath) {
    console.log("  ⚠  Unity CLI binary not found! Install it or set UNITY_PATH env var.\n");
  }
});
