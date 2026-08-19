use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::Command;

use super::error::{AppError, AppResult, CliError};

/// Standard JSON envelope returned by every `unity --json` command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliResponse<T> {
    pub success: bool,
    pub command: String,
    pub data: T,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Locate the `unity` CLI binary on the system.
/// Checks PATH, then common install locations for each platform.
pub fn find_unity_binary() -> Option<String> {
    // 1. Check PATH (which::which handles .exe resolution on Windows automatically)
    if let Ok(path) = which::which("unity") {
        return Some(path.to_string_lossy().to_string());
    }

    // 2. Check common install locations per platform
    let candidates = platform_candidates();

    for candidate in &candidates {
        if std::path::Path::new(candidate).exists() {
            return Some(candidate.clone());
        }
    }

    None
}

/// Build the list of candidate paths for the unity binary per platform.
fn platform_candidates() -> Vec<String> {
    let mut candidates = Vec::new();

    if cfg!(target_os = "windows") {
        // Windows: USERPROFILE\.unity\bin\unity.exe
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        if !home.is_empty() {
            candidates.push(format!("{}\\.unity\\bin\\unity.exe", home));
        }
        // Also check LOCALAPPDATA (some installers use it)
        let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
        if !local.is_empty() {
            candidates.push(format!("{}\\unity\\unity.exe", local));
        }
    } else {
        // macOS / Linux: HOME-based paths
        let home = std::env::var("HOME").unwrap_or_default();
        if !home.is_empty() {
            candidates.push(format!("{}/.unity/bin/unity", home));
            candidates.push(format!("{}/.local/bin/unity", home));
        }
        // System-wide locations (Linux)
        candidates.push("/usr/local/bin/unity".to_string());
        candidates.push("/usr/bin/unity".to_string());
    }

    candidates
}

/// Ensure the unity binary is available, returning its path or an error.
pub fn require_unity() -> AppResult<String> {
    find_unity_binary().ok_or_else(|| AppError::not_found(
        "Unity CLI binary not found. Install it from https://unity.com or set the path in Settings."
    ))
}

/// Run a `unity` command with `--json --no-banner` flags and parse the JSON output.
/// `args` should NOT include `--json` or `--no-banner` — they are added automatically.
pub async fn run_unity_json<T: serde::de::DeserializeOwned>(args: &[&str]) -> AppResult<T> {
    let binary = require_unity()?;

    let mut cmd_args = vec!["--json", "--no-banner"];
    cmd_args.extend_from_slice(args);

    let output = Command::new(&binary)
        .args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| AppError::io(&format!("Failed to spawn unity: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let code = output.status.code().unwrap_or(-1);

    // Try to parse stdout JSON first — the CLI may return valid JSON with
    // success:true even on non-zero exit codes (e.g. `auth status` exits 3
    // when session is expired, but stdout JSON is valid and usable).
    match serde_json::from_str::<CliResponse<T>>(&stdout) {
        Ok(response) if response.success => Ok(response.data),
        Ok(response) => {
            let msg = if response.errors.is_empty() {
                "Command reported failure without error message".to_string()
            } else {
                response.errors.join("; ")
            };
            Err(AppError::cli(CliError { code, message: msg, stderr }))
        }
        Err(_) if !output.status.success() => {
            Err(AppError::cli(CliError {
                code,
                message: format!("unity {} exited with code {}", args.join(" "), code),
                stderr,
            }))
        }
        Err(e) => {
            Err(AppError::io(&format!(
                "Failed to parse JSON output from unity: {}\nstdout: {}",
                e,
                &stdout[..stdout.len().min(500)]
            )))
        }
    }
}

/// Run a `unity` command without JSON parsing (for human-readable or streaming use).
/// Returns raw stdout. Does NOT throw on non-zero exit codes — the CLI uses exit
/// codes as secondary signals (e.g. `auth status` exits 3 when session expired
/// but still prints valid output). Callers that need error checking should parse
/// the output themselves.
pub async fn run_unity_plain(args: &[&str]) -> AppResult<String> {
    let binary = require_unity()?;

    let output = Command::new(&binary)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| AppError::io(&format!("Failed to spawn unity: {}", e)))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Build a CLI command string for display (the "Copy CLI Command" feature).
/// Returns the full command as it would appear in a terminal.
pub fn build_command_string(args: &[&str], json: bool) -> String {
    let mut parts = vec!["unity"];
    if json {
        parts.push("--json");
    }
    for arg in args {
        parts.push(arg);
    }
    parts.join(" ")
}
