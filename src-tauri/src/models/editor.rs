use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Editor {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub alias: String,
    #[serde(default)]
    pub architecture: String,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub modules: Option<String>,
    #[serde(default)]
    pub upgradeTo: Option<String>,
    #[serde(default)]
    pub default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Release {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub stream: String,
    #[serde(default)]
    pub lts: bool,
    #[serde(default)]
    pub releaseDate: Option<String>,
    #[serde(default)]
    pub downloadUrl: Option<String>,
    #[serde(default)]
    pub changeset: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningEditor {
    #[serde(default, alias = "unityVersion")]
    pub version: String,
    #[serde(default)]
    pub pid: i64,
    #[serde(default)]
    pub projectPath: Option<String>,
    #[serde(default)]
    pub projectName: Option<String>,
    #[serde(default)]
    pub port: Option<i64>,
    #[serde(default)]
    pub hasPipeline: bool,
    #[serde(default)]
    pub reachable: bool,
}

/// Wrapper for `unity editors running --json` which returns { count, instances: [...] }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningEditorsResponse {
    #[serde(default)]
    pub count: i64,
    #[serde(default)]
    pub instances: Vec<RunningEditor>,
}
