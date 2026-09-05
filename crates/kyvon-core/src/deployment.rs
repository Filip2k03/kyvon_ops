use crate::TimestampMs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentStatus {
    Healthy,
    Warning,
    Critical,
    Failed,
    RollingBack,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeploymentRecord {
    pub id: String,
    pub server_id: String,
    pub application: String,
    pub environment: String, // Production, Staging
    pub version: String,
    pub git_commit: String,
    pub git_branch: String,
    pub git_repo: Option<String>,
    pub deployed_at_ms: TimestampMs,
    pub duration_seconds: u32,
    pub status: DeploymentStatus,
    pub instances: u32,
    pub cpu_pct: f64,
    pub ram_mb: f64,
    pub error_rate_pct: f64,
    pub requests_per_min: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConfigDriftItem {
    pub resource_name: String,
    pub path: String,
    pub expected_value: String,
    pub actual_value: String,
    pub is_drifted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConfigurationDriftReport {
    pub server_id: String,
    pub checked_at_ms: TimestampMs,
    pub items: Vec<ConfigDriftItem>,
    pub total_drift_count: u32,
}
