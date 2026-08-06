use crate::core::cli_executor;
use crate::core::error::AppResult;
use crate::models::{Editor, Release, RunningEditor, RunningEditorsResponse};

/// List installed Unity editors.
#[tauri::command]
pub async fn list_editors() -> AppResult<Vec<Editor>> {
    cli_executor::run_unity_json(&["editors", "--installed"]).await
}

/// List available Unity releases for download.
#[tauri::command]
pub async fn list_releases(lts: Option<bool>, stream: Option<String>, since: Option<i32>, limit: Option<i32>) -> AppResult<Vec<Release>> {
    let mut args: Vec<String> = vec!["releases".to_string()];
    if lts == Some(true) {
        args.push("--lts".to_string());
    }
    if let Some(s) = stream {
        args.push("--stream".to_string());
        args.push(s);
    }
    if let Some(y) = since {
        args.push("--since".to_string());
        args.push(y.to_string());
    }
    if let Some(n) = limit {
        args.push("--limit".to_string());
        args.push(n.to_string());
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// List running Unity editor instances.
#[tauri::command]
pub async fn list_running_editors() -> AppResult<Vec<RunningEditor>> {
    let resp: RunningEditorsResponse = cli_executor::run_unity_json(&["editors", "running"]).await?;
    Ok(resp.instances)
}

/// Get info about a specific editor version.
#[tauri::command]
pub async fn editor_info(version: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["editors", "info", &version]).await
}

/// Get the install path for an editor version.
#[tauri::command]
pub async fn editor_path(version: String) -> AppResult<String> {
    cli_executor::run_unity_plain(&["editors", "path", &version]).await
}

/// Set default editor version.
#[tauri::command]
pub async fn set_default_editor(version: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["editors", "default", &version]).await
}

/// Unset default editor version.
#[tauri::command]
pub async fn unset_default_editor() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["editors", "default", "--unset"]).await
}

/// Get the current default editor version.
#[tauri::command]
pub async fn get_default_editor() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["editors", "default"]).await
}

/// Uninstall an editor version.
#[tauri::command]
pub async fn uninstall_editor(version: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["uninstall", &version, "--yes"]).await
}

/// List modules for an editor version.
#[tauri::command]
pub async fn list_modules(version: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["modules", "list", &version]).await
}

/// Add modules to an installed editor.
#[tauri::command]
pub async fn add_modules(version: String, modules: Vec<String>, architecture: Option<String>, accept_eula: Option<bool>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["editors".to_string(), "module".to_string(), "add".to_string(), version];
    args.push("--module".to_string());
    args.push(modules.join(" "));
    if let Some(a) = architecture {
        args.push("--architecture".to_string());
        args.push(a);
    }
    if accept_eula == Some(true) {
        args.push("--accept-eula".to_string());
    }
    args.push("--yes".to_string());
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Remove modules from an installed editor.
#[tauri::command]
pub async fn remove_modules(version: String, modules: Vec<String>, architecture: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["editors".to_string(), "module".to_string(), "remove".to_string(), version];
    args.push("--module".to_string());
    args.push(modules.join(" "));
    if let Some(a) = architecture {
        args.push("--architecture".to_string());
        args.push(a);
    }
    args.push("--yes".to_string());
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Check for editor upgrades (dry run).
#[tauri::command]
pub async fn check_editor_upgrades() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["editors", "upgrade", "--check"]).await
}

/// Get the editor install path setting.
#[tauri::command]
pub async fn get_install_path() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["editors", "install-path"]).await
}

/// Set the editor install path.
#[tauri::command]
pub async fn set_install_path(path: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["editors", "install-path", "--set", &path]).await
}

/// Upgrade an installed editor to the latest patch on its release line.
#[tauri::command]
pub async fn editors_upgrade(version: String, replace: Option<bool>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["editors".to_string(), "upgrade".to_string(), version, "--yes".to_string(), "--accept-eula".to_string()];
    if replace == Some(true) {
        args.push("--replace".to_string());
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}
