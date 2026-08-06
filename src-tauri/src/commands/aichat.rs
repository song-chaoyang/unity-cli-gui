use crate::core::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

/// AI chat request body sent to the gateway
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

/// Response from the AI gateway
#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChatMessage,
}

/// Send a chat completion request to an AI gateway.
/// The gateway should be OpenAI-compatible (POST /v1/chat/completions).
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

    let req = ChatRequest {
        model,
        messages,
        max_tokens,
        temperature,
    };

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&req)
        .send()
        .await
        .map_err(|e| AppError::io(&format!("AI request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::io(&format!(
            "AI gateway returned {}: {}",
            status,
            &body[..body.len().min(500)]
        )));
    }

    let chat_resp: ChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::io(&format!("Failed to parse AI response: {}", e)))?;

    chat_resp
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| AppError::io("AI returned no choices"))
}

/// Test the AI gateway connection with a simple request.
#[tauri::command]
pub async fn ai_test_connection(
    gateway_url: String,
    api_key: String,
    model: String,
) -> AppResult<String> {
    let messages = vec![ChatMessage {
        role: "user".to_string(),
        content: "Hi".to_string(),
    }];

    let result = ai_chat(gateway_url, api_key, model, messages, Some(10), Some(0.0)).await?;
    Ok(result)
}

/// Get the system locale (e.g. "zh_CN", "en_US").
#[tauri::command]
pub async fn get_system_locale() -> String {
    // Use the locale crate's functionality via env vars
    // On macOS/Linux: LANG, LC_ALL, LC_MESSAGES
    // On Windows: we rely on the frontend navigator.language
    for var in &["LC_ALL", "LC_MESSAGES", "LANG"] {
        if let Ok(val) = std::env::var(var) {
            if !val.is_empty() && val != "C" && val != "POSIX" {
                return val;
            }
        }
    }
    "en".to_string()
}

/// Read a text file and return its content.
#[tauri::command]
pub async fn read_file_content(path: String) -> AppResult<String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(AppError::not_found(&format!("File not found: {}", path)));
    }
    std::fs::read_to_string(p)
        .map_err(|e| AppError::io(&format!("Failed to read file: {}", e)))
}

/// Write content to a text file (creates parent dirs if needed).
#[tauri::command]
pub async fn write_file_content(path: String, content: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::io(&format!("Failed to create directory: {}", e)))?;
    }
    std::fs::write(p, content)
        .map_err(|e| AppError::io(&format!("Failed to write file: {}", e)))
}
