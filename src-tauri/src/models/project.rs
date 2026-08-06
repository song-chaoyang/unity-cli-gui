use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub architecture: String,
    #[serde(default)]
    pub changeset: Option<String>,
    #[serde(default)]
    pub isFavorite: bool,
    #[serde(default)]
    pub cloudEnabled: bool,
    #[serde(default)]
    pub buildTarget: Option<String>,
    #[serde(default)]
    pub renderPipeline: Option<String>,
    #[serde(default)]
    pub lastModified: Option<i64>,
    #[serde(default)]
    pub localProjectId: Option<String>,
    #[serde(default)]
    pub vcsConfigurationPath: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheInfo {
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub sizeBytes: u64,
    #[serde(default)]
    pub size: String,
    #[serde(default)]
    pub fileCount: u64,
    #[serde(default)]
    pub unreadable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvInfo {
    #[serde(default)]
    pub userDataPath: String,
    #[serde(default)]
    pub editorInstallPath: String,
    #[serde(default)]
    pub downloadCachePath: String,
    #[serde(default)]
    pub configPath: String,
    #[serde(default)]
    pub hubVersion: String,
}
