use crate::TimestampMs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServerIdentity {
    pub provider: String,
    pub public_ipv4: String,
    pub hostname: String,
    pub os: String,
    pub kernel: String,
    pub architecture: String,
    pub cpu_cores: u32,
    pub ram_bytes: u64,
    pub disk_bytes: u64,
    pub swap_bytes: u64,
    pub uptime_seconds: u64,
    pub timezone: String,
    pub kernel_security: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct DiscoveredInfrastructure {
    pub has_nginx: bool,
    pub has_docker: bool,
    pub has_kubernetes: bool,
    pub has_systemd: bool,
    pub has_ssh: bool,
    pub has_firewall: bool,
    pub has_cron: bool,
    pub open_ports: Vec<u16>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DiscoveredApplication {
    pub domain: String,
    pub name: String,
    pub runtime: String,
    pub framework: Option<String>,
    pub port: u16,
    pub path: String,
    pub container_id: Option<String>,
    pub pid: Option<u32>,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiscoveredDatabase {
    pub kind: String, // postgresql, mysql, redis, mongodb
    pub port: u16,
    pub version: Option<String>,
    pub connection_count: Option<u32>,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DigitalTwin {
    pub server_id: String,
    pub identity: ServerIdentity,
    pub infra: DiscoveredInfrastructure,
    pub applications: Vec<DiscoveredApplication>,
    pub databases: Vec<DiscoveredDatabase>,
    pub runtimes: Vec<String>,
    pub last_synced_ms: TimestampMs,
}
