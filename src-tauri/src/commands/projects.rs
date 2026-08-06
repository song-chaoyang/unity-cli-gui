use crate::core::cli_executor;
use crate::core::error::{AppError, AppResult};
use crate::models::{CacheInfo, EnvInfo, Project};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Per-project metadata stored locally by the GUI (not by the CLI).
/// Keyed by the project path.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_type: Option<String>, // "emoji" | "color" | "image"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_value: Option<String>, // emoji char, color hex, or image path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_editor_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_build_target: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_architecture: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_extra_args: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

/// Get the path to the project metadata file.
fn meta_file_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    let dir = if home.is_empty() {
        PathBuf::from(".unity-gui")
    } else {
        PathBuf::from(home).join(".unity-gui")
    };
    let _ = std::fs::create_dir_all(&dir);
    dir.join("project-meta.json")
}

/// Load all project metadata from the local JSON file.
fn load_all_meta() -> HashMap<String, ProjectMeta> {
    let path = meta_file_path();
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

/// Save all project metadata to the local JSON file.
fn save_all_meta(map: &HashMap<String, ProjectMeta>) {
    let path = meta_file_path();
    if let Ok(json) = serde_json::to_string_pretty(map) {
        let _ = std::fs::write(&path, json);
    }
}

/// Get metadata for a single project.
#[tauri::command]
pub async fn get_project_meta(project_path: String) -> ProjectMeta {
    let map = load_all_meta();
    map.get(&project_path).cloned().unwrap_or_default()
}

/// Set metadata for a single project (merges with existing).
#[tauri::command]
pub async fn set_project_meta(project_path: String, meta: ProjectMeta) -> AppResult<()> {
    let mut map = load_all_meta();
    map.insert(project_path, meta);
    save_all_meta(&map);
    Ok(())
}

/// Add an existing project folder to the Hub registry.
#[tauri::command]
pub async fn add_existing_project(path: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["projects", "add", &path]).await
}

/// Open a project with full parameter set.
#[tauri::command]
pub async fn open_project_with_params(
    project: String,
    editor_version: Option<String>,
    editor_path: Option<String>,
    architecture: Option<String>,
    build_target: Option<String>,
    build_target_group: Option<String>,
    extra_args: Option<String>,
) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["open".to_string(), project];

    if let Some(v) = editor_version {
        args.push("--editor-version".to_string());
        args.push(v);
    }
    if let Some(p) = editor_path {
        args.push("--editor-path".to_string());
        args.push(p);
    }
    if let Some(a) = architecture {
        args.push("--architecture".to_string());
        args.push(a);
    }
    if let Some(bt) = build_target {
        args.push("--build-target".to_string());
        args.push(bt);
    }
    if let Some(btg) = build_target_group {
        args.push("--build-target-group".to_string());
        args.push(btg);
    }
    if let Some(ea) = extra_args {
        args.push("--args".to_string());
        args.push(ea);
    }

    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Get git information for a project path.
#[tauri::command]
pub async fn get_git_info(project_path: String) -> serde_json::Value {
    let p = std::path::Path::new(&project_path);
    if !p.is_dir() {
        return serde_json::json!({ "isGit": false });
    }
    let git_dir = p.join(".git");
    if !git_dir.exists() {
        return serde_json::json!({ "isGit": false });
    }
    let branch = std::process::Command::new("git")
        .args(["-C", &project_path, "rev-parse", "--abbrev-ref", "HEAD"])
        .output().ok()
        .and_then(|o| if o.status.success() { Some(String::from_utf8_lossy(&o.stdout).trim().to_string()) } else { None })
        .unwrap_or_default();
    let repo_url = std::process::Command::new("git")
        .args(["-C", &project_path, "remote", "get-url", "origin"])
        .output().ok()
        .and_then(|o| if o.status.success() { Some(String::from_utf8_lossy(&o.stdout).trim().to_string()) } else { None })
        .unwrap_or_default();
    let dirty = std::process::Command::new("git")
        .args(["-C", &project_path, "status", "--porcelain"])
        .output().ok()
        .map(|o| !o.stdout.is_empty())
        .unwrap_or(false);
    serde_json::json!({ "isGit": true, "branch": branch, "repoUrl": repo_url, "dirty": dirty })
}

/// Reveal a path in the system file manager.
#[tauri::command]
pub async fn reveal_in_file_manager(path: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(AppError::not_found(&format!("Path not found: {}", path)));
    }
    let target = if p.is_dir() {
        path.clone()
    } else {
        p.parent()
            .map(|parent| parent.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone())
    };
    tauri_plugin_opener::reveal_item_in_dir(target)
        .map_err(|e| AppError::io(&format!("Failed to open file manager: {}", e)))
}

/// Open a system terminal at the given project path.
#[tauri::command]
pub async fn open_terminal_at_path(path: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    if !p.is_dir() {
        return Err(AppError::not_found(&format!("Directory not found: {}", path)));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Terminal", &path])
            .spawn()
            .map_err(|e| AppError::io(&format!("Failed to open Terminal: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try common terminal emulators
        let terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "xterm"];
        let mut found = false;
        for term in &terminals {
            if std::process::Command::new(term)
                .args(["--working-directory", &path])
                .spawn().is_ok()
            {
                found = true;
                break;
            }
        }
        if !found {
            return Err(AppError::io("No terminal emulator found"));
        }
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "cmd", "/K", &format!("cd /d {}", path)])
            .spawn()
            .map_err(|e| AppError::io(&format!("Failed to open cmd: {}", e)))?;
    }

    Ok(())
}

/// Open a project in the default code editor (VS Code if available).
#[tauri::command]
pub async fn open_in_editor(path: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(AppError::not_found(&format!("Path not found: {}", path)));
    }

    // Try 'code' (VS Code) first, then fall back to system default
    let editors = ["code", "cursor", "zed"];
    for editor in &editors {
        if std::process::Command::new(editor)
            .arg(&path)
            .spawn().is_ok()
        {
            return Ok(());
        }
    }

    // Fall back to system file manager
    tauri_plugin_opener::reveal_item_in_dir(path.clone())
        .map_err(|e| AppError::io(&format!("Failed to open: {}", e)))
}

/// List Hub-registered Unity projects, enriched with GUI metadata.
#[tauri::command]
pub async fn list_projects() -> AppResult<Vec<Project>> {
    cli_executor::run_unity_json(&["projects", "list", "-a"]).await
}

/// Get project info.
#[tauri::command]
pub async fn project_info(path_or_name: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<&str> = vec!["projects", "info"];
    if let Some(p) = path_or_name.as_deref() {
        args.push(p);
    }
    cli_executor::run_unity_json(&args).await
}

/// Open a project in Unity Editor.
#[tauri::command]
pub async fn open_project(project: String, editor_version: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["open".to_string(), project];
    if let Some(v) = editor_version {
        args.push("--editor-version".to_string());
        args.push(v);
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Check/ensure required editor is installed for a project.
#[tauri::command]
pub async fn project_require(path_or_name: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<&str> = vec!["projects", "require", "--yes"];
    if let Some(p) = path_or_name.as_deref() {
        args.insert(2, p);
    }
    cli_executor::run_unity_json(&args).await
}

/// Get project disk usage. Pass all=true to get all projects at once.
#[tauri::command]
pub async fn project_size(project: Option<String>, all: Option<bool>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["projects".to_string(), "size".to_string()];
    if all == Some(true) {
        args.push("--all".to_string());
    } else if let Some(p) = project {
        args.push(p);
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Pin (favorite) a project.
#[tauri::command]
pub async fn pin_project(pattern: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["projects", "pin", &pattern]).await
}

/// Unpin a project.
#[tauri::command]
pub async fn unpin_project(pattern: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["projects", "unpin", &pattern]).await
}

/// Remove a project from Hub registry (does not delete files).
#[tauri::command]
pub async fn remove_project(path: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["projects", "remove", &path]).await
}

/// Upgrade a project to a different editor version.
#[tauri::command]
pub async fn upgrade_project(path_or_name: Option<String>, to_version: String) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["projects".to_string(), "upgrade".to_string(), "--to".to_string(), to_version, "--yes".to_string()];
    if let Some(p) = path_or_name {
        args.insert(2, p);
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// List available project templates.
#[tauri::command]
pub async fn list_templates(editor_version: Option<String>, installed_only: Option<bool>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["templates".to_string(), "list".to_string()];
    if let Some(v) = editor_version {
        args.push("--editor".to_string());
        args.push(v);
    }
    if installed_only == Some(true) {
        args.push("--installed".to_string());
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Create a new Unity project (non-interactive, CI-friendly).
#[tauri::command]
pub async fn create_project(
    name: String,
    path: Option<String>,
    editor_version: Option<String>,
    template: Option<String>,
    open: Option<bool>,
) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["projects".to_string(), "new".to_string(), name];
    if let Some(p) = path {
        args.push("--path".to_string());
        args.push(p);
    }
    if let Some(v) = editor_version {
        args.push("--editor-version".to_string());
        args.push(v);
    }
    if let Some(t) = template {
        args.push("--template".to_string());
        args.push(t);
    }
    if open == Some(true) {
        args.push("--open".to_string());
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Get cache info.
#[tauri::command]
pub async fn cache_info() -> AppResult<CacheInfo> {
    cli_executor::run_unity_json(&["cache", "info"]).await
}

/// Clean download cache.
#[tauri::command]
pub async fn cache_clean() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["cache", "clean", "--yes"]).await
}

/// Get Unity Hub environment info.
#[tauri::command]
pub async fn get_env() -> AppResult<EnvInfo> {
    cli_executor::run_unity_json(&["env"]).await
}

/// Clone a remote repository and register its Unity project.
#[tauri::command]
pub async fn project_clone(
    vcs: String, vcs_namespace: String, vcs_repo: String,
    git_token: Option<String>, ref_name: Option<String>,
    dest_path: Option<String>, project_path: Option<String>,
) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["projects".to_string(), "clone".to_string()];
    args.push("--vcs".to_string()); args.push(vcs);
    args.push("--vcs-namespace".to_string()); args.push(vcs_namespace);
    args.push("--vcs-repo".to_string()); args.push(vcs_repo);
    if let Some(r) = ref_name { args.push("--ref".to_string()); args.push(r); }
    if let Some(d) = dest_path { args.push("--path".to_string()); args.push(d); }
    if let Some(pp) = project_path { args.push("--project-path".to_string()); args.push(pp); }
    if let Some(t) = git_token { args.push("--git-token".to_string()); args.push(t); }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Link a local project to its cloud or version control link.
#[tauri::command]
pub async fn project_link(project_path: Option<String>, link_type: Option<String>) -> AppResult<serde_json::Value> {
    let lt = link_type.unwrap_or_else(|| "cloud".to_string());
    let mut args: Vec<String> = vec!["projects".to_string(), "link".to_string(), lt];
    if let Some(p) = project_path { args.push(p); }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Unlink a local project from its cloud or version control link.
#[tauri::command]
pub async fn project_unlink(project_path: Option<String>, link_type: Option<String>) -> AppResult<serde_json::Value> {
    let lt = link_type.unwrap_or_else(|| "cloud".to_string());
    let mut args: Vec<String> = vec!["projects".to_string(), "unlink".to_string(), lt];
    if let Some(p) = project_path { args.push(p); }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Export Hub project list to JSON.
#[tauri::command]
pub async fn projects_export(output_file: Option<String>) -> AppResult<String> {
    let mut args: Vec<String> = vec!["projects".to_string(), "export".to_string()];
    if let Some(f) = output_file { args.push("--output".to_string()); args.push(f); }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_plain(&args_ref).await
}

/// Import Hub project list from JSON.
#[tauri::command]
pub async fn projects_import(input_file: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["projects".to_string(), "import".to_string()];
    if let Some(f) = input_file { args.push(f); }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Refresh module list for an editor version.
#[tauri::command]
pub async fn refresh_modules(version: String) -> AppResult<serde_json::Value> {
    let args: Vec<&str> = vec!["editors", "module", "refresh", &version];
    cli_executor::run_unity_json(&args).await
}

/// Submit a bug report.
#[tauri::command]
pub async fn submit_bug(
    title: String, description: String, email: Option<String>,
    steps: Option<Vec<String>>, reproducibility: Option<String>,
) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["bug".to_string(), "--title".to_string(), title, "--description".to_string(), description];
    if let Some(e) = email { args.push("--email".to_string()); args.push(e); }
    if let Some(s) = steps { args.push("--steps".to_string()); args.extend(s); }
    if let Some(r) = reproducibility { args.push("--reproducibility".to_string()); args.push(r); }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// List Unity Cloud projects.
#[tauri::command]
pub async fn cloud_project_list(cloud_org: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["cloud".to_string(), "project".to_string(), "list".to_string()];
    if let Some(o) = cloud_org { args.push("--cloud-org".to_string()); args.push(o); }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// List floating license servers.
#[tauri::command]
pub async fn license_server_list() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["license", "server", "list"]).await
}

/// Get floating license server status.
#[tauri::command]
pub async fn license_server_status() -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["license", "server", "status"]).await
}

/// Create a custom template from an existing project.
#[tauri::command]
pub async fn template_create(
    project_path: String, name: String, display_name: Option<String>,
    description: Option<String>, template_version: Option<String>, output: Option<String>,
) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["templates".to_string(), "create".to_string(), project_path];
    args.push("--name".to_string()); args.push(name);
    if let Some(d) = display_name { args.push("--display-name".to_string()); args.push(d); }
    if let Some(d) = description { args.push("--description".to_string()); args.push(d); }
    if let Some(v) = template_version { args.push("--template-version".to_string()); args.push(v); }
    if let Some(o) = output { args.push("--output".to_string()); args.push(o); }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Delete a custom template.
#[tauri::command]
pub async fn template_delete(name: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["templates", "delete", &name]).await
}

/// Get/set custom template location.
#[tauri::command]
pub async fn template_location(set_path: Option<String>) -> AppResult<serde_json::Value> {
    let mut args: Vec<String> = vec!["templates".to_string(), "location".to_string()];
    if let Some(p) = set_path { args.push("--set".to_string()); args.push(p); }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Edit custom template metadata.
#[tauri::command]
pub async fn template_edit(name: String) -> AppResult<serde_json::Value> {
    cli_executor::run_unity_json(&["templates", "edit", &name]).await
}
