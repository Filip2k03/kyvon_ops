//! What the MCP gateway needs from the rest of the system.
//!
//! `kyvon-policy` deliberately does not depend on `kyvon-storage` or
//! `kyvon-ssh`: policy decides what an agent is *allowed* to see and do, and
//! coupling that to a particular store would make the rules harder to test and
//! easier to bypass. The gateway therefore asks for data through this trait,
//! and whoever runs it supplies an implementation — `apps/mcp` over the local
//! database today, and a session-aware one inside the desktop later.
//!
//! Two properties are structural rather than conventional:
//!
//! * **Nothing here can execute anything.** Every method is a read. A write
//!   reaching a host has to travel through the approval gate and an executor
//!   that is not reachable from this trait, so attaching a backend cannot
//!   accidentally hand an agent the ability to change infrastructure.
//! * **Staleness is part of the answer.** [`MetricReading`] carries the
//!   timestamp of the sample, because a stored reading is evidence about the
//!   past and an agent reasoning about "current" load needs to know how old
//!   its evidence is. Returning a bare number would invite exactly the
//!   fabrication this codebase keeps having to remove.

use kyvon_core::{Result, ServerProfile, TimestampMs};

/// One stored metric sample, with the time it was taken.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MetricReading {
    /// Metric key as written by the collector: `cpu.total`, `mem.used_pct`.
    pub metric: String,
    pub value: f64,
    /// When the sample was taken, not when it was read.
    pub recorded_at: TimestampMs,
}

/// Read-only access to what KyvonOPS has recorded.
#[async_trait::async_trait]
pub trait InfrastructureBackend: Send + Sync {
    /// Every server in the local inventory.
    async fn list_servers(&self) -> Result<Vec<ServerProfile>>;

    /// One server, or `None` when the id is unknown.
    ///
    /// `None` is not an error: an agent asking about a server that was deleted
    /// should be told it does not exist, not handed a failure it might retry.
    async fn get_server(&self, server_id: &str) -> Result<Option<ServerProfile>>;

    /// The most recent recorded value of each known metric for a server,
    /// regardless of age.
    ///
    /// Age is deliberately not filtered here. An empty result must mean
    /// "nothing was ever collected for this host" and nothing else, because
    /// that is a different statement from "nothing recent", and the caller
    /// cannot recover the distinction once it has been thrown away. Applying a
    /// freshness window in the backend made the gateway assert that a host had
    /// never been measured when its collector had merely stopped twenty
    /// minutes ago — the precise kind of confident falsehood §108 exists to
    /// prevent. The gateway judges staleness from `recorded_at`.
    async fn latest_metrics(&self, server_id: &str) -> Result<Vec<MetricReading>>;
}
