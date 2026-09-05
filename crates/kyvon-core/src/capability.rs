use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::TimestampMs;

/// What the remote host actually provides.
///
/// The UI is driven by this map (specification §53, §89): a panel is rendered
/// only when the corresponding capability is present, and otherwise shows an
/// explicit "not available on this host" state rather than dead controls.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Capabilities {
    #[serde(flatten)]
    inner: BTreeMap<String, bool>,
}

/// Capability keys used across the application. Kept as constants so a typo
/// cannot silently disable a feature.
pub mod caps {
    pub const SYSTEMD: &str = "systemd";
    pub const JOURNALCTL: &str = "journalctl";
    pub const PROC: &str = "proc";
    pub const DOCKER: &str = "docker";
    pub const SS: &str = "ss";
    pub const IP: &str = "ip";
    pub const UFW: &str = "ufw";
    pub const FIREWALLD: &str = "firewalld";
    pub const NFTABLES: &str = "nftables";
    pub const IPTABLES: &str = "iptables";
    pub const NGINX: &str = "nginx";
    pub const APACHE: &str = "apache";
    pub const POSTGRES: &str = "postgres";
    pub const MYSQL: &str = "mysql";
    pub const REDIS: &str = "redis";
    pub const NODE: &str = "node";
    pub const PHP: &str = "php";
    pub const PYTHON: &str = "python";
    pub const SUDO_NOPASSWD: &str = "sudo_nopasswd";
    pub const EBPF: &str = "ebpf";

    /// Everything probed during onboarding, in probe order.
    pub const ALL: &[&str] = &[
        SYSTEMD,
        JOURNALCTL,
        PROC,
        DOCKER,
        SS,
        IP,
        UFW,
        FIREWALLD,
        NFTABLES,
        IPTABLES,
        NGINX,
        APACHE,
        POSTGRES,
        MYSQL,
        REDIS,
        NODE,
        PHP,
        PYTHON,
        SUDO_NOPASSWD,
        EBPF,
    ];
}

impl Capabilities {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set(&mut self, key: &str, present: bool) -> &mut Self {
        self.inner.insert(key.to_string(), present);
        self
    }

    /// Absent keys read as `false`: a capability that was never probed is not
    /// available, and the UI must not offer it.
    pub fn has(&self, key: &str) -> bool {
        self.inner.get(key).copied().unwrap_or(false)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&String, &bool)> {
        self.inner.iter()
    }

    pub fn present(&self) -> Vec<&str> {
        self.inner
            .iter()
            .filter(|(_, v)| **v)
            .map(|(k, _)| k.as_str())
            .collect()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }
}

impl FromIterator<(String, bool)> for Capabilities {
    fn from_iter<T: IntoIterator<Item = (String, bool)>>(iter: T) -> Self {
        Self {
            inner: iter.into_iter().collect(),
        }
    }
}

/// One capability check, as streamed to the UI during onboarding so the user
/// sees real progress rather than a spinner (specification §9).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityProbe {
    pub key: String,
    /// Short label shown in the onboarding log, e.g. "systemd detected".
    pub label: String,
    pub present: bool,
    /// Version string when the probe could determine one.
    #[serde(default)]
    pub version: Option<String>,
}

/// Static facts about a host, gathered once at onboarding and refreshed on
/// demand. Distinct from telemetry: these change rarely.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct HostFacts {
    /// `ID` from /etc/os-release, e.g. `ubuntu`.
    pub os_id: String,
    /// `PRETTY_NAME` from /etc/os-release.
    pub os_name: String,
    pub os_version: String,
    /// `uname -m`, e.g. `x86_64`.
    pub arch: String,
    /// `uname -r`.
    pub kernel: String,
    pub hostname: String,
    /// `apt`, `dnf`, `yum`, `apk`, `pacman`, `zypper` — empty if undetected.
    pub package_manager: String,
    pub cpu_cores: u32,
    pub memory_total_bytes: u64,
    /// Seconds since boot at probe time.
    pub uptime_secs: u64,
    /// Best-effort cloud provider with an explicit confidence, never asserted
    /// on thin evidence (specification §72).
    #[serde(default)]
    pub cloud: Option<CloudHint>,
    #[serde(default)]
    pub capabilities: Capabilities,
    #[serde(default)]
    pub probed_at: TimestampMs,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CloudHint {
    pub provider: String,
    /// `high` when a vendor-specific DMI field matched, `low` for weaker
    /// signals such as a hostname pattern.
    pub confidence: Confidence,
    /// The literal string the guess was made from, so the user can judge it.
    pub evidence: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Confidence {
    High,
    Medium,
    Low,
}
