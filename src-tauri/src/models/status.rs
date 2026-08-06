use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorStatus {
    #[serde(default)]
    pub port: Option<i64>,
    #[serde(default, alias = "projectPath")]
    pub project: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub pid: Option<i64>,
    #[serde(default)]
    pub state: Option<String>,
}

/// Wrapper for `unity status --json` which returns { count, instances: [...] }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusResponse {
    #[serde(default)]
    pub count: i64,
    #[serde(default)]
    pub instances: Vec<EditorStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineEntry {
    #[serde(default)]
    pub projectName: Option<String>,
    #[serde(default)]
    pub projectPath: Option<String>,
    #[serde(default)]
    pub pid: Option<i64>,
    #[serde(default)]
    pub isRunning: bool,
    #[serde(default)]
    pub hasPipelinePackage: bool,
    #[serde(default)]
    pub pipelineVersion: Option<String>,
    #[serde(default)]
    pub updateAvailable: bool,
}

/// Wrapper for `unity pipeline list --json` which returns { instances, latestVersion, summary }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListResponse {
    #[serde(default)]
    pub instances: Vec<PipelineEntry>,
    #[serde(default)]
    pub latestVersion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpClientInfo {
    pub key: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(default)]
    pub configPath: Option<String>,
    #[serde(default)]
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageInfo {
    #[serde(default)]
    pub current: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub available: Vec<LanguageEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageEntry {
    pub code: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthInfo {
    #[serde(default)]
    pub loggedIn: bool,
    #[serde(default)]
    pub user: Option<AuthUser>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyInfo {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsInfo {
    #[serde(default)]
    pub optedIn: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpgradeInfo {
    #[serde(default)]
    pub currentVersion: String,
    #[serde(default)]
    pub latestVersion: String,
    #[serde(default)]
    pub platform: Option<String>,
}
