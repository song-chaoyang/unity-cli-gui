use serde::Serialize;
use std::fmt;

#[derive(Debug, Clone, Serialize)]
pub struct CliError {
    pub code: i32,
    pub message: String,
    pub stderr: String,
}

impl fmt::Display for CliError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "CLI Error (code {}): {}", self.code, self.message)
    }
}

impl std::error::Error for CliError {}

#[derive(Debug, Clone, Serialize)]
pub struct AppError {
    pub message: String,
    pub kind: String,
}

impl AppError {
    pub fn cli(err: CliError) -> Self {
        AppError {
            message: err.message,
            kind: "cli".to_string(),
        }
    }

    pub fn not_found(msg: &str) -> Self {
        AppError {
            message: msg.to_string(),
            kind: "not_found".to_string(),
        }
    }

    pub fn io(msg: &str) -> Self {
        AppError {
            message: msg.to_string(),
            kind: "io".to_string(),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.kind, self.message)
    }
}

impl std::error::Error for AppError {}

pub type AppResult<T> = Result<T, AppError>;
