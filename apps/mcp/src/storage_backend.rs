//! The MCP gateway's view of the local store.
//!
//! `kyvon-policy` defines what the gateway may ask for; this supplies it from
//! the same SQLite file the desktop writes. The separation is deliberate —
//! policy stays testable without a database, and this layer cannot widen what
//! an agent is allowed to see, because it can only answer questions the trait
//! already permits.
//!
//! It opens the database read-write because `sqlx` needs to; it never issues a
//! write. There is no execution path here at all: an agent reaching this code
//! can read what KyvonOPS recorded and nothing else.

use kyvon_core::{Result, ServerProfile};
use kyvon_policy::backend::{InfrastructureBackend, MetricReading};
use kyvon_storage::{Database, MetricRepo, ServerRepo};

/// How far back to look for a "latest" reading.
///
/// A value older than this is not reported at all. An agent asking about
/// health is reasoning about now, and a day-old sample answers a different
/// question than the one being asked — better to say nothing was measured
/// than to hand over evidence that quietly refers to yesterday.
const FRESHNESS_WINDOW_MS: i64 = 15 * 60 * 1000;

pub struct StorageBackend {
    db: Database,
}

impl StorageBackend {
    pub fn new(db: Database) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl InfrastructureBackend for StorageBackend {
    async fn list_servers(&self) -> Result<Vec<ServerProfile>> {
        ServerRepo::new(self.db.clone()).list().await
    }

    async fn get_server(&self, server_id: &str) -> Result<Option<ServerProfile>> {
        ServerRepo::new(self.db.clone()).get(server_id).await
    }

    async fn latest_metrics(&self, server_id: &str) -> Result<Vec<MetricReading>> {
        let repo = MetricRepo::new(self.db.clone());
        let now = kyvon_core::now_ms();
        let from = now - FRESHNESS_WINDOW_MS;

        let mut readings = Vec::new();
        for metric in repo.known_metrics(server_id).await? {
            // The last point in the window, if the window has any.
            if let Some(point) = repo
                .series(server_id, &metric, from, now)
                .await?
                .into_iter()
                .next_back()
            {
                readings.push(MetricReading {
                    metric,
                    value: point.value,
                    recorded_at: point.ts,
                });
            }
        }
        Ok(readings)
    }
}
