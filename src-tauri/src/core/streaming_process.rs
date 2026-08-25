use serde::Serialize;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::LazyLock;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;
use tokio::sync::Mutex;

use super::error::{AppError, AppResult};

static NEXT_ID: AtomicU64 = AtomicU64::new(0);

/// Track running streaming processes so they can be cancelled.
static RUNNING_PROCESSES: LazyLock<Mutex<HashMap<u64, oneshot::Sender<()>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// A handle to a running streaming process.
#[derive(Debug, Clone, Serialize)]
pub struct ProcessHandle {
    pub id: u64,
    pub command: String,
}

/// Common: register a spawned child in the cancel map and stream its stdout/stderr/exit
/// as `<prefix>-stdout`, `<prefix>-stderr`, `<prefix>-exit` events.
async fn spawn_and_stream(
    app: &AppHandle,
    event_prefix: &str,
    mut child: tokio::process::Child,
    cmd_str: String,
) -> AppResult<ProcessHandle> {
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    {
        let mut map = RUNNING_PROCESSES.lock().await;
        map.insert(id, cancel_tx);
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stream stdout
    if let Some(stdout) = stdout {
        let app_clone = app.clone();
        let prefix = event_prefix.to_string();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_clone.emit(
                    &format!("{}-stdout", prefix),
                    serde_json::json!({ "line": line }),
                );
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = stderr {
        let app_clone = app.clone();
        let prefix = event_prefix.to_string();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_clone.emit(
                    &format!("{}-stderr", prefix),
                    serde_json::json!({ "line": line }),
                );
            }
        });
    }

    // Wait for exit or cancellation
    let app_clone = app.clone();
    let prefix = event_prefix.to_string();
    let id_for_cleanup = id;
    let cmd_str_for_closure = cmd_str.clone();
    tokio::spawn(async move {
        tokio::select! {
            status = child.wait() => {
                let (code, success) = match status {
                    Ok(s) => (s.code().unwrap_or(-1), s.success()),
                    Err(_) => (-1, false),
                };
                let _ = app_clone.emit(
                    &format!("{}-exit", prefix),
                    serde_json::json!({ "code": code, "success": success, "command": cmd_str_for_closure }),
                );
            }
            _ = cancel_rx => {
                // Kill the child process so it doesn't keep running in the background
                let _ = child.kill().await;
                let _ = child.wait().await;
                let _ = app_clone.emit(
                    &format!("{}-exit", prefix),
                    serde_json::json!({ "code": -2, "success": false, "command": cmd_str_for_closure, "cancelled": true }),
                );
            }
        }
        let mut map = RUNNING_PROCESSES.lock().await;
        map.remove(&id_for_cleanup);
    });

    Ok(ProcessHandle { id, command: cmd_str })
}

/// Start a long-running `unity` command and stream stdout/stderr lines as Tauri events.
/// `event_prefix` determines the event names: `<event_prefix>-stdout`, `<event_prefix>-stderr`,
/// `<event_prefix>-exit`.
pub async fn start_streaming(
    app: &AppHandle,
    event_prefix: &str,
    args: &[&str],
    include_json_flags: bool,
) -> AppResult<ProcessHandle> {
    let binary = super::cli_executor::require_unity()?;

    let mut cmd_args = Vec::new();
    if include_json_flags {
        cmd_args.push("--json");
        cmd_args.push("--no-banner");
    }
    cmd_args.extend_from_slice(args);

    let child = Command::new(&binary)
        .args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::io(&format!("Failed to spawn unity: {}", e)))?;

    let cmd_str = super::cli_executor::build_command_string(args, include_json_flags);
    spawn_and_stream(app, event_prefix, child, cmd_str).await
}

/// Start an arbitrary shell command and stream stdout/stderr lines as Tauri events.
/// Does NOT require the unity binary — used for installing the CLI itself.
/// On macOS/Linux: `/bin/sh -c "<shell_cmd>"`; on Windows: `powershell -NoProfile -Command "<shell_cmd>"`.
pub async fn start_raw_stream(
    app: &AppHandle,
    event_prefix: &str,
    shell_cmd: &str,
) -> AppResult<ProcessHandle> {
    let mut command = if cfg!(target_os = "windows") {
        let mut c = Command::new("powershell");
        c.args(["-NoProfile", "-NonInteractive", "-Command", shell_cmd]);
        c
    } else {
        let mut c = Command::new("/bin/sh");
        c.args(["-c", shell_cmd]);
        c
    };

    let child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::io(&format!("Failed to spawn shell command: {}", e)))?;

    spawn_and_stream(app, event_prefix, child, shell_cmd.to_string()).await
}

/// Cancel a running streaming process by ID.
pub async fn cancel_process(id: u64) -> AppResult<()> {
    let mut map = RUNNING_PROCESSES.lock().await;
    if let Some(tx) = map.remove(&id) {
        let _ = tx.send(());
        Ok(())
    } else {
        Err(AppError::not_found(&format!(
            "Process {} not found or already finished",
            id
        )))
    }
}
