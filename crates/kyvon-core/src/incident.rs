use crate::TimestampMs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IncidentSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IncidentStatus {
    Detected,
    Investigating,
    Mitigated,
    Resolved,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IncidentEvent {
    pub timestamp_ms: TimestampMs,
    pub description: String,
    pub metric_change: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Incident {
    pub id: String,
    pub server_id: String,
    pub title: String,
    pub severity: IncidentSeverity,
    pub status: IncidentStatus,
    pub detected_at_ms: TimestampMs,
    pub affected_resource: String,
    pub likely_cause: String,
    pub timeline: Vec<IncidentEvent>,
    pub recommended_action: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WhatChangedItem {
    pub category: String, // Deployment, Nginx, Docker, System, Database, Resources, Network
    pub description: String,
    pub is_anomalous: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WhatChangedReport {
    pub server_id: String,
    pub timeframe: String, // e.g. "today", "last 6h"
    pub generated_at_ms: TimestampMs,
    pub changes: Vec<WhatChangedItem>,
}
