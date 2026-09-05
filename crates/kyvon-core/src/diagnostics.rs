use crate::TimestampMs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SitePerformanceReport {
    pub domain: String,
    pub dns_ms: f64,
    pub tls_ms: f64,
    pub nginx_ms: f64,
    pub backend_ms: f64,
    pub database_ms: f64,
    pub redis_ms: f64,
    pub external_api_ms: f64,
    pub primary_bottleneck: String,
    pub avg_latency_ms: f64,
    pub p95_ms: f64,
    pub p99_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutageRiskLevel {
    Low,
    Moderate,
    High,
    Critical,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RiskFactor {
    pub name: String,
    pub score_impact: i32,
    pub current_value: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OutageRiskScore {
    pub score: u32, // 0 - 100
    pub level: OutageRiskLevel,
    pub factors: Vec<RiskFactor>,
    pub recommendation: String,
    pub calculated_at_ms: TimestampMs,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CapacityForecastPoint {
    pub hours_ahead: u32,
    pub projected_cpu_pct: f64,
    pub projected_ram_pct: f64,
    pub projected_disk_pct: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CapacityForecast {
    pub current_utilization_pct: f64,
    pub reserved_headroom_pct: f64,
    pub projected_saturation_days: Option<f64>,
    pub points: Vec<CapacityForecastPoint>,
    pub bottleneck_resource: String,
}
