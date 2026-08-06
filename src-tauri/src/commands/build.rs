use crate::core::cli_executor;
use crate::core::error::AppResult;
use crate::core::streaming_process;
use tauri::AppHandle;

use crate::core::streaming_process::ProcessHandle;

/// Run a build with streaming output.
/// Returns a process handle; stdout/stderr/exit events are emitted as "build-stdout" etc.
#[tauri::command]
pub async fn start_build(
    app: AppHandle,
    project: String,
    target: String,
    execute_method: String,
    output_path: Option<String>,
    editor_version: Option<String>,
    architecture: Option<String>,
    log_file: Option<String>,
    allow_install: Option<bool>,
    no_tail: Option<bool>,
    extra_args: Option<String>,
) -> AppResult<ProcessHandle> {
    let mut args: Vec<String> = vec![
        "build".to_string(),
        project,
        "--target".to_string(),
        target,
        "--execute-method".to_string(),
        execute_method,
    ];

    if let Some(p) = output_path {
        args.push("--output-path".to_string());
        args.push(p);
    }
    if let Some(v) = editor_version {
        args.push("--editor-version".to_string());
        args.push(v);
    }
    if let Some(a) = architecture {
        args.push("--architecture".to_string());
        args.push(a);
    }
    if let Some(l) = log_file {
        args.push("--log-file".to_string());
        args.push(l);
    }
    if allow_install == Some(true) {
        args.push("--allow-install".to_string());
    }
    if no_tail == Some(true) {
        args.push("--no-tail".to_string());
    }
    if let Some(ea) = extra_args {
        args.push("--args".to_string());
        args.push(ea);
    }

    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    streaming_process::start_streaming(&app, "build", &args_ref, false).await
}

/// Run tests with streaming output.
#[tauri::command]
pub async fn start_test(
    app: AppHandle,
    project: String,
    mode: Option<String>,
    filter: Option<String>,
    output: Option<String>,
    editor_version: Option<String>,
    timeout: Option<i32>,
) -> AppResult<ProcessHandle> {
    let mut args: Vec<String> = vec!["test".to_string(), project];

    if let Some(m) = mode {
        args.push("--mode".to_string());
        args.push(m);
    }
    if let Some(f) = filter {
        args.push("--filter".to_string());
        args.push(f);
    }
    if let Some(o) = output {
        args.push("--output".to_string());
        args.push(o);
    }
    if let Some(v) = editor_version {
        args.push("--editor-version".to_string());
        args.push(v);
    }
    if let Some(t) = timeout {
        args.push("--timeout".to_string());
        args.push(t.to_string());
    }

    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    streaming_process::start_streaming(&app, "test", &args_ref, false).await
}

/// Cancel a running streaming process (build/test/install/etc).
#[tauri::command]
pub async fn cancel_process(id: u64) -> AppResult<()> {
    streaming_process::cancel_process(id).await
}

/// Start installing an editor with streaming output.
#[tauri::command]
pub async fn start_install_editor(
    app: AppHandle,
    version: String,
    modules: Option<Vec<String>>,
    architecture: Option<String>,
    child_modules: Option<bool>,
) -> AppResult<ProcessHandle> {
    let mut args: Vec<String> = vec!["install".to_string(), version, "--yes".to_string(), "--accept-eula".to_string()];

    if let Some(mods) = modules {
        if !mods.is_empty() {
            args.push("--module".to_string());
            args.push(mods.join(" "));
        }
    }
    if let Some(a) = architecture {
        args.push("--architecture".to_string());
        args.push(a);
    }
    if child_modules == Some(true) {
        args.push("--childModules".to_string());
    }

    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    streaming_process::start_streaming(&app, "install", &args_ref, false).await
}

/// Build a CLI command string for display purposes.
#[tauri::command]
pub async fn build_command_string(args: Vec<String>, json: bool) -> String {
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    cli_executor::build_command_string(&args_ref, json)
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

/// Run an arbitrary unity command and return stdout as a string.
/// `args` should NOT include `--json` or `--no-banner` — they are added when `json` is true.
#[tauri::command]
pub async fn run_unity_command(args: Vec<String>, json: bool) -> AppResult<String> {
    if json {
        let mut cmd_args: Vec<&str> = vec!["--json", "--no-banner"];
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        cmd_args.extend_from_slice(&arg_refs);
        cli_executor::run_unity_plain(&cmd_args).await
    } else {
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        cli_executor::run_unity_plain(&arg_refs).await
    }
}
