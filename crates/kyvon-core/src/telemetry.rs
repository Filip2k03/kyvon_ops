use serde::{Deserialize, Serialize};

use crate::TimestampMs;

/// One line of the agent's NDJSON stream.
///
/// The wire form is `{"v":1,"ts":<ms>,"type":"cpu","data":{...}}`. `type` and
/// `data` are represented by the tagged [`Payload`] enum so an unknown frame
/// type is a recoverable parse error rather than a silent misread.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Frame {
    #[serde(rename = "v")]
    pub version: u32,
    pub ts: TimestampMs,
    #[serde(flatten)]
    pub payload: Payload,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum Payload {
    /// Sent once when the collector starts, before any sample.
    Hello(AgentHello),
    Cpu(CpuSample),
    Memory(MemorySample),
    Network(NetworkSample),
    Disk(DiskSample),
    Processes(ProcessSample),
    Services(ServiceSample),
    /// Listening sockets. Sampled on the slow cadence alongside `Disk`.
    Ports(PortSample),
    /// A non-fatal problem inside the collector, surfaced rather than dropped.
    Error(AgentError),
}

impl Payload {
    pub fn kind(&self) -> &'static str {
        match self {
            Payload::Hello(_) => "hello",
            Payload::Cpu(_) => "cpu",
            Payload::Memory(_) => "memory",
            Payload::Network(_) => "network",
            Payload::Disk(_) => "disk",
            Payload::Processes(_) => "processes",
            Payload::Services(_) => "services",
            Payload::Ports(_) => "ports",
            Payload::Error(_) => "error",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentHello {
    pub agent_version: String,
    pub protocol: u32,
    pub hostname: String,
    pub kernel: String,
    pub arch: String,
    /// Collector names that this host can actually serve.
    pub collectors: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentError {
    pub collector: String,
    pub message: String,
}

// ---------------------------------------------------------------- CPU

/// A CPU sample. All percentages are of total time across the interval between
/// this sample and the previous one, so the first sample of a stream is
/// necessarily absent (the agent emits nothing until it has two readings).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CpuSample {
    pub total: f32,
    pub user: f32,
    pub system: f32,
    pub iowait: f32,
    pub steal: f32,
    pub idle: f32,
    #[serde(default)]
    pub nice: f32,
    #[serde(default)]
    pub irq: f32,
    /// Per-core busy percentage, index = core number.
    #[serde(default)]
    pub cores: Vec<f32>,
    /// 1, 5 and 15 minute load averages.
    pub load: [f32; 3],
    #[serde(default)]
    pub ctx_switches: Option<u64>,
    #[serde(default)]
    pub procs_running: Option<u32>,
    #[serde(default)]
    pub procs_blocked: Option<u32>,
}

impl CpuSample {
    /// Load average per core — the figure that actually indicates saturation.
    /// Returns `None` when the core count is unknown.
    pub fn load_per_core(&self, cores: u32) -> Option<f32> {
        (cores > 0).then(|| self.load[0] / cores as f32)
    }

    /// Whether this sample shows CPU pressure worth surfacing: sustained
    /// non-idle time, or significant iowait/steal which point at the disk and
    /// the hypervisor respectively rather than at the workload.
    pub fn pressure(&self, cores: u32) -> CpuPressure {
        let load = self.load_per_core(cores).unwrap_or(0.0);
        if self.steal > 10.0 {
            CpuPressure::Steal
        } else if self.iowait > 20.0 {
            CpuPressure::Io
        } else if self.total > 90.0 || load > 2.0 {
            CpuPressure::Saturated
        } else if self.total > 70.0 || load > 1.0 {
            CpuPressure::Elevated
        } else {
            CpuPressure::Nominal
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CpuPressure {
    Nominal,
    Elevated,
    Saturated,
    /// Blocked on disk rather than compute.
    Io,
    /// The hypervisor is taking cycles away from this guest.
    Steal,
}

// ------------------------------------------------------------- Memory

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct MemorySample {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub free_bytes: u64,
    pub cached_bytes: u64,
    pub buffers_bytes: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
    /// PSI `some avg60` for memory, when /proc/pressure is available.
    #[serde(default)]
    pub pressure_some_avg60: Option<f32>,
}

impl MemorySample {
    /// Percentage genuinely unavailable to new allocations. Uses
    /// `MemAvailable`, not `used`, because page cache is reclaimable and
    /// counting it as used is the classic way to misread Linux memory.
    pub fn utilisation_pct(&self) -> f32 {
        if self.total_bytes == 0 {
            return 0.0;
        }
        let unavailable = self.total_bytes.saturating_sub(self.available_bytes);
        (unavailable as f64 / self.total_bytes as f64 * 100.0) as f32
    }

    pub fn swap_pct(&self) -> f32 {
        if self.swap_total_bytes == 0 {
            return 0.0;
        }
        (self.swap_used_bytes as f64 / self.swap_total_bytes as f64 * 100.0) as f32
    }
}

// ------------------------------------------------------------ Network

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NetworkSample {
    pub interfaces: Vec<NetworkInterface>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    /// Rate over the sample interval, not a cumulative counter.
    pub rx_bytes_per_sec: u64,
    pub tx_bytes_per_sec: u64,
    pub rx_packets_per_sec: u64,
    pub tx_packets_per_sec: u64,
    pub rx_errors: u64,
    pub tx_errors: u64,
    pub rx_dropped: u64,
    pub tx_dropped: u64,
}

/// Every listening socket the host reported in one reading.
///
/// An empty list is a real observation (nothing is listening, or `ss` could
/// not see anything); the absence of a `Ports` frame means `ss` is not
/// installed and the fact is unknown. The two must stay distinguishable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PortSample {
    pub ports: Vec<PortInfo>,
}

/// A socket in the LISTEN state, from `ss -lntup` or /proc/net/{tcp,udp}.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PortInfo {
    pub port: u16,
    /// `tcp`, `tcp6`, `udp`, `udp6`.
    pub protocol: String,
    pub address: String,
    #[serde(default)]
    pub process: Option<String>,
    #[serde(default)]
    pub pid: Option<u32>,
    /// Derived from the bind address: a service on 0.0.0.0 is reachable from
    /// anywhere the firewall permits, one on 127.0.0.1 is not.
    pub exposure: Exposure,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Exposure {
    /// Bound to a loopback address.
    Loopback,
    /// Bound to a specific non-loopback address.
    Interface,
    /// Bound to all addresses (0.0.0.0 or ::).
    AllInterfaces,
}

impl Exposure {
    /// Classify a socket's *bind address*, with the port already removed.
    ///
    /// Accepts every form `ss` prints: `0.0.0.0`, `*`, the bracketed IPv6
    /// wildcard `[::]`, and a link-local address carrying a zone identifier
    /// such as `127.0.0.53%lo`.
    pub fn from_bind_address(addr: &str) -> Self {
        let host = addr.trim_matches(|c| c == '[' || c == ']');
        // A zone identifier (`%lo`) names the interface, not the address.
        let host = host.split('%').next().unwrap_or(host);
        match host {
            "" | "*" | "0.0.0.0" | "::" | "[::]" => Exposure::AllInterfaces,
            h if h.starts_with("127.") || h == "::1" || h == "localhost" => Exposure::Loopback,
            _ => Exposure::Interface,
        }
    }
}

// --------------------------------------------------------------- Disk

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiskSample {
    pub filesystems: Vec<FilesystemInfo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FilesystemInfo {
    pub mount_point: String,
    pub device: String,
    pub fs_type: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    #[serde(default)]
    pub inodes_total: u64,
    #[serde(default)]
    pub inodes_used: u64,
}

impl FilesystemInfo {
    /// Usage against the space actually usable by this user. `total - available`
    /// rather than the raw `used` field, so reserved blocks are not counted as
    /// free — this matches what `df` reports and what will actually fail first.
    pub fn used_pct(&self) -> f32 {
        let usable = self.used_bytes + self.available_bytes;
        if usable == 0 {
            return 0.0;
        }
        (self.used_bytes as f64 / usable as f64 * 100.0) as f32
    }

    /// Inode exhaustion fills a disk that still reports free bytes.
    pub fn inodes_used_pct(&self) -> Option<f32> {
        (self.inodes_total > 0)
            .then(|| (self.inodes_used as f64 / self.inodes_total as f64 * 100.0) as f32)
    }

    /// Pseudo-filesystems occupy no real storage and only add noise.
    pub fn is_real_storage(&self) -> bool {
        !matches!(
            self.fs_type.as_str(),
            "tmpfs"
                | "devtmpfs"
                | "squashfs"
                | "overlay"
                | "proc"
                | "sysfs"
                | "cgroup"
                | "cgroup2"
                | "devpts"
                | "efivarfs"
                | "ramfs"
                | "autofs"
                | "mqueue"
                | "hugetlbfs"
                | "debugfs"
                | "tracefs"
                | "fusectl"
                | "configfs"
                | "pstore"
                | "bpf"
                | "binfmt_misc"
                | "nsfs"
        )
    }
}

// ---------------------------------------------------------- Processes

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProcessSample {
    pub processes: Vec<ProcessInfo>,
    /// Total process count on the host, which may exceed `processes.len()`
    /// because the agent sends only the top consumers.
    pub total: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    #[serde(default)]
    pub ppid: u32,
    pub user: String,
    pub cpu_pct: f32,
    pub mem_pct: f32,
    pub rss_bytes: u64,
    /// Single-letter state from `ps`: R, S, D, Z, T.
    pub state: String,
    /// Full command line, already passed through secret redaction.
    pub command: String,
    /// Seconds since the process started.
    #[serde(default)]
    pub uptime_secs: u64,
}

impl ProcessInfo {
    /// Uninterruptible sleep means blocked in the kernel, usually on IO — a
    /// process in this state is not consuming CPU but is still stuck.
    pub fn is_blocked(&self) -> bool {
        self.state.starts_with('D')
    }

    pub fn is_zombie(&self) -> bool {
        self.state.starts_with('Z')
    }
}

// ----------------------------------------------------------- Services

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServiceSample {
    pub services: Vec<ServiceInfo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServiceInfo {
    /// Full unit name including suffix, e.g. `nginx.service`.
    pub unit: String,
    /// `loaded`, `not-found`, `masked`.
    pub load_state: String,
    /// `active`, `inactive`, `failed`, `activating`, `deactivating`.
    pub active_state: String,
    /// `running`, `exited`, `dead`, `failed`, `auto-restart`.
    pub sub_state: String,
    #[serde(default)]
    pub description: String,
    /// `enabled`, `disabled`, `static`, `masked`; absent when not queried.
    #[serde(default)]
    pub enabled: Option<String>,
    /// Milliseconds since the unit last entered the active state.
    #[serde(default)]
    pub active_since_ms: Option<TimestampMs>,
    #[serde(default)]
    pub restarts: Option<u32>,
}

impl ServiceInfo {
    pub fn is_failed(&self) -> bool {
        self.active_state == "failed" || self.sub_state == "failed"
    }

    pub fn is_running(&self) -> bool {
        self.active_state == "active" && self.sub_state == "running"
    }

    /// A unit systemd is cycling: active but waiting to restart again.
    pub fn is_restart_looping(&self) -> bool {
        self.sub_state == "auto-restart" || self.restarts.is_some_and(|r| r >= 3)
    }
}

// ------------------------------------------------------------ Rollups

/// A downsampled metric bucket, written by the aggregator and read by the
/// historical charts. One row per (server, metric, bucket).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct MetricAggregate {
    pub bucket_start_ms: TimestampMs,
    pub avg: f64,
    pub min: f64,
    pub max: f64,
    pub p95: f64,
    pub samples: u32,
}

/// Retention tiers for stored telemetry (specification §40).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Resolution {
    /// Every sample as received.
    Raw,
    OneMinute,
    FiveMinute,
    Hourly,
}

impl Resolution {
    pub fn bucket_ms(self) -> i64 {
        match self {
            Resolution::Raw => 0,
            Resolution::OneMinute => 60_000,
            Resolution::FiveMinute => 300_000,
            Resolution::Hourly => 3_600_000,
        }
    }

    /// Default retention window in milliseconds.
    pub fn retention_ms(self) -> i64 {
        match self {
            Resolution::Raw => 24 * 3_600_000,
            Resolution::OneMinute => 7 * 24 * 3_600_000,
            Resolution::FiveMinute => 30 * 24 * 3_600_000,
            Resolution::Hourly => 365 * 24 * 3_600_000,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Resolution::Raw => "raw",
            Resolution::OneMinute => "1m",
            Resolution::FiveMinute => "5m",
            Resolution::Hourly => "1h",
        }
    }

    /// The coarsest resolution that still yields enough points to draw a
    /// readable chart over `window_ms`.
    pub fn for_window(window_ms: i64) -> Self {
        match window_ms {
            w if w <= 3_600_000 => Resolution::Raw,
            w if w <= 6 * 3_600_000 => Resolution::OneMinute,
            w if w <= 7 * 24 * 3_600_000 => Resolution::FiveMinute,
            _ => Resolution::Hourly,
        }
    }
}
