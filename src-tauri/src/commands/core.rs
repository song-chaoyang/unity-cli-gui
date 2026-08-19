use crate::core::cli_executor;
use crate::core::error::{AppError, AppResult};
use crate::core::streaming_process::{self, ProcessHandle};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;

// ─── Generic CLI execution ──────────────────────────────────────────────────

/// Run `unity --json --no-banner <args>`, parse the {success, data, errors} envelope, return data.
#[tauri::command]
pub async fn run_unity_json(args: Vec<String>) -> AppResult<serde_json::Value> {
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_json(&args_ref).await
}

/// Run `unity <args>`, return raw stdout as string.
#[tauri::command]
pub async fn run_unity_plain(args: Vec<String>) -> AppResult<String> {
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::run_unity_plain(&args_ref).await
}

/// Start a streaming unity process. Events: `<prefix>-stdout/stderr/exit`.
#[tauri::command]
pub async fn start_streaming(
    app: AppHandle,
    prefix: String,
    args: Vec<String>,
    include_json_flags: bool,
) -> AppResult<ProcessHandle> {
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    streaming_process::start_streaming(&app, &prefix, &args_ref, include_json_flags).await
}

/// Start an arbitrary shell command (for CLI install). Events: `<prefix>-stdout/stderr/exit`.
#[tauri::command]
pub async fn start_raw_stream(
    app: AppHandle,
    prefix: String,
    shell_cmd: String,
) -> AppResult<ProcessHandle> {
    streaming_process::start_raw_stream(&app, &prefix, &shell_cmd).await
}

/// Cancel a running streaming process by ID.
#[tauri::command]
pub async fn cancel_process(id: u64) -> AppResult<()> {
    streaming_process::cancel_process(id).await
}

/// Check if the unity CLI binary is available.
#[tauri::command]
pub async fn check_unity_available() -> bool {
    cli_executor::find_unity_binary().is_some()
}

/// Get the path to the unity CLI binary.
#[tauri::command]
pub async fn get_unity_path() -> AppResult<String> {
    cli_executor::require_unity()
}

// ─── AI Chat (HTTP) ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChatMessage,
}

#[tauri::command]
pub async fn ai_chat(
    gateway_url: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: Option<i32>,
    temperature: Option<f64>,
) -> AppResult<String> {
    let client = reqwest::Client::new();
    let url = if gateway_url.ends_with('/') {
        format!("{}v1/chat/completions", gateway_url)
    } else {
        format!("{}/v1/chat/completions", gateway_url)
    };
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&ChatRequest { model, messages, max_tokens, temperature })
        .send()
        .await
        .map_err(|e| AppError::io(&format!("AI request failed: {}", e)))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::io(&format!("AI gateway returned {}: {}", status, &body[..body.len().min(500)])));
    }
    let chat_resp: ChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::io(&format!("Failed to parse AI response: {}", e)))?;
    chat_resp.choices.into_iter().next()
        .map(|c| c.message.content)
        .ok_or_else(|| AppError::io("AI returned no choices"))
}

// ─── Git info ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_git_info(project_path: String) -> serde_json::Value {
    let p = std::path::Path::new(&project_path);
    if !p.is_dir() || !p.join(".git").exists() {
        return serde_json::json!({ "isGit": false });
    }
    let run = |args: &[&str]| std::process::Command::new("git").args(args).output().ok()
        .and_then(|o| if o.status.success() { Some(String::from_utf8_lossy(&o.stdout).trim().to_string()) } else { None })
        .unwrap_or_default();
    serde_json::json!({
        "isGit": true,
        "branch": run(&["-C", &project_path, "rev-parse", "--abbrev-ref", "HEAD"]),
        "repoUrl": run(&["-C", &project_path, "remote", "get-url", "origin"]),
        "dirty": std::process::Command::new("git").args(["-C", &project_path, "status", "--porcelain"]).output()
            .map(|o| !o.stdout.is_empty()).unwrap_or(false),
    })
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn read_file_content(path: String) -> AppResult<String> {
    if !std::path::Path::new(&path).exists() {
        return Err(AppError::not_found(&format!("File not found: {}", path)));
    }
    std::fs::read_to_string(&path).map_err(|e| AppError::io(&format!("Failed to read file: {}", e)))
}

#[tauri::command]
pub async fn write_file_content(path: String, content: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::io(&format!("Failed to create directory: {}", e)))?;
    }
    std::fs::write(p, content).map_err(|e| AppError::io(&format!("Failed to write file: {}", e)))
}

// ─── OS interactions ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn reveal_in_file_manager(path: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(AppError::not_found(&format!("Path not found: {}", path)));
    }
    let target = if p.is_dir() { path.clone() }
        else { p.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or(path.clone()) };
    tauri_plugin_opener::reveal_item_in_dir(target)
        .map_err(|e| AppError::io(&format!("Failed to open file manager: {}", e)))
}

#[tauri::command]
pub async fn open_terminal_at_path(path: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    if !p.is_dir() {
        return Err(AppError::not_found(&format!("Directory not found: {}", path)));
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").args(["-a", "Terminal", &path]).spawn()
            .map_err(|e| AppError::io(&format!("Failed to open Terminal: {}", e)))?;
    }
    #[cfg(target_os = "linux")]
    {
        let terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "xterm"];
        let mut found = false;
        for term in &terminals {
            if std::process::Command::new(term).args(["--working-directory", &path]).spawn().is_ok() {
                found = true; break;
            }
        }
        if !found { return Err(AppError::io("No terminal emulator found")); }
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd").args(["/C", "start", "cmd", "/K", &format!("cd /d {}", path)]).spawn()
            .map_err(|e| AppError::io(&format!("Failed to open cmd: {}", e)))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_in_editor(path: String) -> AppResult<()> {
    if !std::path::Path::new(&path).exists() {
        return Err(AppError::not_found(&format!("Path not found: {}", path)));
    }
    for editor in &["code", "cursor", "zed"] {
        if std::process::Command::new(editor).arg(&path).spawn().is_ok() {
            return Ok(());
        }
    }
    tauri_plugin_opener::reveal_item_in_dir(path)
        .map_err(|e| AppError::io(&format!("Failed to open: {}", e)))
}

// ─── Hub detection ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn check_hub_installed() -> serde_json::Value {
    let (installed, path) = find_hub();
    serde_json::json!({ "installed": installed, "path": path })
}

fn find_hub() -> (bool, String) {
    let candidates: Vec<String> = if cfg!(target_os = "macos") {
        let home = std::env::var("HOME").unwrap_or_default();
        vec!["/Applications/Unity Hub.app".into(), format!("{}/Applications/Unity Hub.app", home), format!("{}/MacOS/Unity Hub.app", home)]
    } else if cfg!(target_os = "windows") {
        let pf = std::env::var("ProgramFiles").unwrap_or_default();
        let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_default();
        let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
        vec![format!("{}\\Unity Hub\\Unity Hub.exe", pf), format!("{}\\Unity Hub\\Unity Hub.exe", pf86), format!("{}\\Programs\\Unity Hub\\Unity Hub.exe", local)]
    } else {
        let home = std::env::var("HOME").unwrap_or_default();
        vec!["/usr/bin/unity-hub".into(), "/usr/local/bin/unity-hub".into(), "/opt/unity-hub/unity-hub".into(),
             format!("{}/.local/share/unity-hub/unity-hub", home), format!("{}/Unity Hub/unity-hub", home),
             "/snap/unity-hub/current/bin/unity-hub".into()]
    };
    for c in &candidates { if std::path::Path::new(c).exists() { return (true, c.clone()); } }
    if let Ok(p) = which::which("unity-hub") { return (true, p.to_string_lossy().to_string()); }
    (false, String::new())
}

// ─── Project meta (local JSON) ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectMeta {
    #[serde(skip_serializing_if = "Option::is_none")] pub custom_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub icon_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub icon_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub open_editor_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub open_build_target: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub open_architecture: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub open_extra_args: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub notes: Option<String>,
}

fn meta_file_path() -> PathBuf {
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_default();
    let dir = if home.is_empty() { PathBuf::from(".unity-gui") } else { PathBuf::from(home).join(".unity-gui") };
    let _ = std::fs::create_dir_all(&dir);
    dir.join("project-meta.json")
}

#[tauri::command]
pub async fn get_project_meta(project_path: String) -> ProjectMeta {
    match std::fs::read_to_string(meta_file_path()) {
        Ok(content) => serde_json::from_str::<HashMap<String, ProjectMeta>>(&content).unwrap_or_default()
            .get(&project_path).cloned().unwrap_or_default(),
        Err(_) => ProjectMeta::default(),
    }
}

#[tauri::command]
pub async fn set_project_meta(project_path: String, meta: ProjectMeta) -> AppResult<()> {
    let path = meta_file_path();
    let mut map: HashMap<String, ProjectMeta> = std::fs::read_to_string(&path)
        .ok().and_then(|c| serde_json::from_str(&c).ok()).unwrap_or_default();
    map.insert(project_path, meta);
    std::fs::write(&path, serde_json::to_string_pretty(&map).unwrap_or_default())
        .map_err(|e| AppError::io(&format!("Failed to write meta: {}", e)))
}

// ─── System locale ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_system_locale() -> String {
    for var in &["LC_ALL", "LC_MESSAGES", "LANG"] {
        if let Ok(val) = std::env::var(var) {
            if !val.is_empty() && val != "C" && val != "POSIX" {
                return val;
            }
        }
    }
    "en".to_string()
}

// ─── Auth login (start streaming process) ────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct AuthLoginResult {
    auth_url: Option<String>,
}

/// Start `unity auth login` as a streaming process. The CLI opens the browser
/// itself and polls Unity's cloud servers for OAuth completion. Returns
/// `{ authUrl: null }` — the frontend polls `auth status` to detect completion.
#[tauri::command]
pub async fn start_auth_login(app: AppHandle) -> AppResult<AuthLoginResult> {
    let args_ref: [&str; 2] = ["auth", "login"];
    streaming_process::start_streaming(&app, "auth-login", &args_ref, false).await?;
    Ok(AuthLoginResult { auth_url: None })
}
