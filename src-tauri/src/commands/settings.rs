use crate::core::cli_executor;
use crate::core::error::AppResult;
use crate::core::streaming_process;
use crate::models::{AnalyticsInfo, AuthInfo, LanguageInfo, ProxyInfo, UpgradeInfo};
use tauri::AppHandle;

use crate::core::streaming_process::ProcessHandle;

/// Start streaming Hub logs.
#[tauri::command]
pub async fn start_log_stream(app: AppHandle, follow: Option<bool>, level: Option<String>, tail: Option<i32>) -> AppResult<ProcessHandle> {
    let mut args: Vec<String> = vec!["logs".to_string()];
    if follow == Some(true) {
        args.push("--follow".to_string());
    }
    if let Some(l) = level {
        args.push("--level".to_string());
        args.push(l);
    }
    if let Some(t) = tail {
        args.push("--tail".to_string());
        args.push(t.to_string());
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    streaming_process::start_streaming(&app, "logs", &args_ref, false).await
}

/// Run doctor diagnostics.
#[tauri::command]
pub async fn run_doctor() -> AppResult<String> {
    cli_executor::run_unity_plain(&["doctor"]).await
}

/// Run diagnose (sanitized diagnostics for support).
#[tauri::command]
pub async fn run_diagnose() -> AppResult<String> {
    cli_executor::run_unity_plain(&["diagnose"]).await
}

/// Get auth status.
#[tauri::command]
pub async fn auth_status() -> AppResult<AuthInfo> {
    cli_executor::run_unity_json(&["auth", "status"]).await
}

/// Login to Unity account.
/// Runs `auth login` which opens browser and blocks until OAuth completes.
/// Returns auth status after login completes.
#[tauri::command]
pub async fn auth_login() -> AppResult<serde_json::Value> {
    // Run auth login directly (it blocks until browser OAuth completes, but that's OK —
    // the frontend shows a loading state during this call)
    let _ = cli_executor::run_unity_plain(&["auth", "login"]).await;
    // Now check actual auth status
    cli_executor::run_unity_json(&["auth", "status"]).await
}

/// Logout from Unity account.
#[tauri::command]
pub async fn auth_logout() -> AppResult<serde_json::Value> {
    // auth logout returns plain text "You have been signed out", not JSON
    // Use run_unity_plain to avoid JSON parse failure
    let _ = cli_executor::run_unity_plain(&["auth", "logout"]).await;
    // Return current status (should be loggedIn=false now)
    cli_executor::run_unity_json(&["auth", "status"]).await
}

/// Get license status.
#[tauri::command]
pub async fn license_status() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["license", "status"]).await
}

/// List licenses.
#[tauri::command]
pub async fn list_licenses() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["license", "list"]).await
}

/// Activate a license.
#[tauri::command]
pub async fn license_activate(
    serial: Option<String>,
    personal: Option<bool>,
    floating: Option<bool>,
    file: Option<String>,
    accept_eula: Option<bool>,
) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["license".to_string(), "activate".to_string()];
    if personal == Some(true) {
        args.push("--personal".to_string());
    }
    if floating == Some(true) {
        args.push("--floating".to_string());
    }
    if let Some(s) = serial {
        args.push("--serial".to_string());
        args.push(s);
    }
    if let Some(f) = file {
        args.push("--file".to_string());
        args.push(f);
    }
    if accept_eula == Some(true) || personal == Some(true) {
        args.push("--accept-eula".to_string());
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Return a license.
#[tauri::command]
pub async fn license_return() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["license", "return", "--yes"]).await
}

/// Get cloud status.
#[tauri::command]
pub async fn cloud_status() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["cloud", "status"]).await
}

/// List cloud organizations.
#[tauri::command]
pub async fn list_cloud_orgs() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["cloud", "org", "list"]).await
}

/// Get language setting (current + available list).
#[tauri::command]
pub async fn get_language() -> AppResult<LanguageInfo> {
    cli_executor::run_unity_json(&["language"]).await
}

/// Set language.
#[tauri::command]
pub async fn set_language(code: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["language", "--set", &code]).await
}

/// Get proxy config.
#[tauri::command]
pub async fn get_proxy() -> AppResult<ProxyInfo> {
    cli_executor::run_unity_json(&["config", "proxy"]).await
}

/// Set proxy config.
#[tauri::command]
pub async fn set_proxy(url: String, bypass: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["config".to_string(), "proxy".to_string(), url];
    if let Some(b) = bypass {
        args.push("--bypass".to_string());
        args.push(b);
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Unset proxy config.
#[tauri::command]
pub async fn unset_proxy() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["config", "proxy", "--unset"]).await
}

/// Get analytics consent status.
#[tauri::command]
pub async fn analytics_status() -> AppResult<AnalyticsInfo> {
    cli_executor::run_unity_json(&["analytics", "status"]).await
}

/// Opt in to analytics.
#[tauri::command]
pub async fn analytics_opt_in() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["analytics", "opt-in"]).await
}

/// Opt out of analytics.
#[tauri::command]
pub async fn analytics_opt_out() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["analytics", "opt-out"]).await
}

/// Check for CLI updates.
#[tauri::command]
pub async fn check_cli_update() -> AppResult<UpgradeInfo> {
    cli_executor::run_unity_json(&["upgrade", "--check"]).await
}

/// Get CLI changelog.
#[tauri::command]
pub async fn get_changelog() -> AppResult<String> {
    cli_executor::run_unity_plain(&["changelog"]).await
}

/// Get update-check setting.
#[tauri::command]
pub async fn get_update_check() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["config", "update-check"]).await
}

/// Set update-check setting.
#[tauri::command]
pub async fn set_update_check(state: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["config", "update-check", &state]).await
}

/// Start CLI self-upgrade with streaming output.
#[tauri::command]
pub async fn start_cli_upgrade(app: AppHandle, yes: Option<bool>) -> AppResult<ProcessHandle> {
    let mut args: Vec<String> = vec!["upgrade".to_string()];
    if yes == Some(true) {
        args.push("--yes".to_string());
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    streaming_process::start_streaming(&app, "upgrade", &args_ref, false).await
}

/// Install Unity Hub.
#[tauri::command]
pub async fn install_hub() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["hub", "install", "--force"]).await
}

/// Check if Unity Hub is installed on the system.
/// Returns a struct with `installed` boolean and `path` if found.
#[tauri::command]
pub async fn check_hub_installed() -> serde_json::Value {
    let (installed, path) = find_hub();
    serde_json::json!({ "installed": installed, "path": path })
}

/// Find the Unity Hub binary on the system.
fn find_hub() -> (bool, String) {
    let candidates: Vec<String> = if cfg!(target_os = "macos") {
        let home = std::env::var("HOME").unwrap_or_default();
        vec![
            "/Applications/Unity Hub.app".to_string(),
            format!("{}/Applications/Unity Hub.app", home),
            format!("{}/MacOS/Unity Hub.app", home),
        ]
    } else if cfg!(target_os = "windows") {
        let progfiles = std::env::var("ProgramFiles").unwrap_or_default();
        let progfiles86 = std::env::var("ProgramFiles(x86)").unwrap_or_default();
        let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
        vec![
            format!("{}\\Unity Hub\\Unity Hub.exe", progfiles),
            format!("{}\\Unity Hub\\Unity Hub.exe", progfiles86),
            format!("{}\\Programs\\Unity Hub\\Unity Hub.exe", local),
        ]
    } else {
        // Linux
        let home = std::env::var("HOME").unwrap_or_default();
        vec![
            "/usr/bin/unity-hub".to_string(),
            "/usr/local/bin/unity-hub".to_string(),
            "/opt/unity-hub/unity-hub".to_string(),
            format!("{}/.local/share/unity-hub/unity-hub", home),
            format!("{}/Unity Hub/unity-hub", home),
            "/snap/unity-hub/current/bin/unity-hub".to_string(),
        ]
    };

    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return (true, c.clone());
        }
    }

    // Also try `which::which` for Linux/macos
    if let Ok(p) = which::which("unity-hub") {
        return (true, p.to_string_lossy().to_string());
    }

    (false, String::new())
}

/// Self-uninstall the Unity CLI.
#[tauri::command]
pub async fn self_uninstall(purge: Option<bool>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["self-uninstall".to_string(), "--yes".to_string()];
    if purge == Some(true) {
        args.push("--purge".to_string());
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}
