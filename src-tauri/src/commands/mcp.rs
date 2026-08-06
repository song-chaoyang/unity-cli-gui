use crate::core::cli_executor;
use crate::core::error::AppResult;
use crate::models::{
    EditorStatus, McpClientInfo, PipelineEntry, PipelineListResponse, StatusResponse,
};

/// Get live status of connected Unity editors.
#[tauri::command]
pub async fn get_status(project_path: Option<String>) -> AppResult<Vec<EditorStatus>> {
    let mut args: Vec<&str> = vec!["status"];
    if let Some(p) = project_path.as_deref() {
        args.push("--project-path");
        args.push(p);
    }
    let resp: StatusResponse = cli_executor::run_unity_json(&args).await?;
    Ok(resp.instances)
}

/// List pipeline status for all editor instances.
#[tauri::command]
pub async fn pipeline_list() -> AppResult<Vec<PipelineEntry>> {
    let resp: PipelineListResponse = cli_executor::run_unity_json(&["pipeline", "list"]).await?;
    Ok(resp.instances)
}

/// List available pipeline versions.
#[tauri::command]
pub async fn pipeline_list_versions() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["pipeline", "list-versions"]).await
}

/// Install pipeline package into a project.
#[tauri::command]
pub async fn pipeline_install(project_path: Option<String>, force: Option<bool>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["pipeline".to_string(), "install".to_string()];
    if let Some(p) = project_path {
        args.push("--project-path".to_string());
        args.push(p);
    }
    if force == Some(true) {
        args.push("--force".to_string());
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Upgrade pipeline package in a project.
#[tauri::command]
pub async fn pipeline_upgrade(project_path: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["pipeline".to_string(), "upgrade".to_string()];
    if let Some(p) = project_path {
        args.push("--project-path".to_string());
        args.push(p);
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// List available commands on a connected editor (Pipeline-registered).
#[tauri::command]
pub async fn list_editor_commands(project_path: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["list".to_string()];
    if let Some(p) = project_path {
        args.push("--project-path".to_string());
        args.push(p);
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Execute a command on a connected editor.
#[tauri::command]
pub async fn execute_editor_command(
    command: String,
    args: Option<Vec<String>>,
    project_path: Option<String>,
    timeout: Option<i32>,
) -> AppResult<serde_json::Value> {
    let mut cmd_args: Vec<String> = vec!["command".to_string(), command];
    if let Some(a) = args {
        cmd_args.extend(a);
    }
    if let Some(p) = project_path {
        cmd_args.push("--project-path".to_string());
        cmd_args.push(p);
    }
    if let Some(t) = timeout {
        cmd_args.push("--timeout".to_string());
        cmd_args.push(t.to_string());
    }
    let args_ref: Vec<&str> = cmd_args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// List supported MCP clients and their configuration status.
#[tauri::command]
pub async fn list_mcp_clients() -> AppResult<Vec<McpClientInfo>> {
    let resp: Vec<McpClientInfo> = cli_executor::run_unity_json(&["mcp", "configure", "--list"]).await?;
    Ok(resp)
}

/// Configure MCP for a specific AI client.
#[tauri::command]
pub async fn configure_mcp_client(
    client: String,
    project_path: Option<String>,
    local: Option<bool>,
    dry_run: Option<bool>,
) -> AppResult<String> {
    let mut args: Vec<String> = vec!["mcp".to_string(), "configure".to_string(), client];
    if let Some(p) = project_path {
        args.push("--project-path".to_string());
        args.push(p);
    }
    if local == Some(true) {
        args.push("--local".to_string());
    }
    if dry_run == Some(true) {
        args.push("--dry-run".to_string());
    }
    args.push("--yes".to_string());
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_plain(&args_ref).await
}
