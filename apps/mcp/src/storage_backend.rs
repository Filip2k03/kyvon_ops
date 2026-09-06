//! The MCP gateway's view of the local store.
//!
//! `kyvon-policy` defines what the gateway may ask for; this supplies it from
//! the same SQLite file the desktop writes. The separation is deliberate —
//! policy stays testable without a database, and this layer cannot widen what
//! an agent is allowed to see, because it can only answer questions the trait
//! already permits.
//!
//! No query here mutates a row. `Database::open` does write — it creates the
//! file if absent, sets WAL journalling and runs migrations — so the store is
//! not opened read-only, but nothing an agent can reach through this type
//! changes any recorded data. There is no execution path here at all.

use kyvon_core::{Result, ServerProfile};
use kyvon_policy::backend::{InfrastructureBackend, MetricReading};
use kyvon_storage::{Database, MetricRepo, ServerRepo};

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
        let rows = MetricRepo::new(self.db.clone())
            .latest_per_metric(server_id)
            .await?;

        Ok(rows
            .into_iter()
            .map(|(metric, recorded_at, value)| MetricReading {
                metric,
                value,
                recorded_at,
            })
            .collect())
    }
}
