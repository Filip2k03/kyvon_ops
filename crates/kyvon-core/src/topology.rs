use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::TimestampMs;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    Domain,
    ReverseProxy,
    ServerBlock,
    Upstream,
    Container,
    Pod,
    Process,
    Port,
    Database,
    ExternalService,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeKind {
    ProxiesTo,
    RunsIn,
    OwnedBy,
    ConnectsTo,
    ListensOn,
    DependsOn,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TopologyNode {
    pub id: String,
    pub kind: NodeKind,
    pub label: String,
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TopologyEdge {
    pub from: String,
    pub to: String,
    pub kind: EdgeKind,
    pub label: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TopologyGraph {
    pub server_id: String,
    pub nodes: Vec<TopologyNode>,
    pub edges: Vec<TopologyEdge>,
    pub generated_at_ms: TimestampMs,
}

/// Site-level resource attribution
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SiteResourceAttribution {
    pub domain: String,
    pub status: String,
    pub response_time_ms: f64,
    pub requests_per_min: u32,
    pub cpu_pct: f64,
    pub ram_mb: f64,
    pub disk_io_mbps: f64,
    pub net_rx_mbps: f64,
    pub net_tx_mbps: f64,
    pub connections: u32,
    pub error_rate_pct: f64,
    pub container_id: Option<String>,
    pub pid: Option<u32>,
    pub runtime: String,
    pub reverse_proxy: String,
    pub database: Option<String>,
    pub cache: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResourceConsumer {
    pub name: String,
    pub kind: String,
    pub percentage: f64,
    pub container: Option<String>,
    pub pid: Option<u32>,
    pub memory_mb: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VpsResourceBreakdown {
    pub total_cpu_pct: f64,
    pub applications_pct: f64,
    pub databases_pct: f64,
    pub docker_pct: f64,
    pub nginx_pct: f64,
    pub system_pct: f64,
    pub other_pct: f64,
    pub top_consumers: Vec<ResourceConsumer>,
}
