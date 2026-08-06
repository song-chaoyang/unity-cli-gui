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

    let mut child = Command::new(&binary)
        .args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::io(&format!("Failed to spawn unity: {}", e)))?;

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
    let cmd_str = super::cli_executor::build_command_string(args, include_json_flags);
    let id_for_cleanup = id;
    tokio::spawn(async move {
        tokio::select! {
            status = child.wait() => {
                let (code, success) = match status {
                    Ok(s) => (s.code().unwrap_or(-1), s.success()),
                    Err(_) => (-1, false),
                };
                let _ = app_clone.emit(
                    &format!("{}-exit", prefix),
                    serde_json::json!({ "code": code, "success": success, "command": cmd_str }),
                );
            }
            _ = cancel_rx => {
                let _ = app_clone.emit(
                    &format!("{}-exit", prefix),
                    serde_json::json!({ "code": -2, "success": false, "command": cmd_str, "cancelled": true }),
                );
            }
        }
        let mut map = RUNNING_PROCESSES.lock().await;
        map.remove(&id_for_cleanup);
    });

    Ok(ProcessHandle {
        id,
        command: super::cli_executor::build_command_string(args, include_json_flags),
    })
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
