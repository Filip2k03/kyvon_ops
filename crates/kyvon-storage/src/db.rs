use std::path::Path;
use std::str::FromStr;

use kyvon_core::{KyvonError, Result};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

/// Handle to the local database.
///
/// Cheap to clone: it wraps a connection pool, not a connection.
#[derive(Clone, Debug)]
pub struct Database {
    pool: sqlx::SqlitePool,
}

pub(crate) fn storage_err(e: sqlx::Error) -> KyvonError {
    KyvonError::Storage(e.to_string())
}

impl Database {
    /// Open (creating if needed) the store at `path` and bring the schema up
    /// to date.
    ///
    /// WAL is enabled because telemetry writes continuously while the UI
    /// reads; in the default rollback-journal mode those would block each
    /// other. `synchronous = NORMAL` is the standard pairing: durable against
    /// a process crash, and a power loss can cost at most the last few
    /// telemetry samples, which are not worth an fsync per write.
    pub async fn open(path: impl AsRef<Path>) -> Result<Self> {
        let options = SqliteConnectOptions::new()
            .filename(path.as_ref())
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .foreign_keys(true)
            .busy_timeout(std::time::Duration::from_secs(5));

        Self::connect(options).await
    }

    /// Open a private in-memory database. Used by tests so they exercise the
    /// real schema and real SQL rather than a stand-in.
    pub async fn open_in_memory() -> Result<Self> {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")
            .map_err(storage_err)?
            .foreign_keys(true);
        Self::connect_with_pool_size(options, 1).await
    }

    async fn connect(options: SqliteConnectOptions) -> Result<Self> {
        Self::connect_with_pool_size(options, 8).await
    }

    async fn connect_with_pool_size(
        options: SqliteConnectOptions,
        max_connections: u32,
    ) -> Result<Self> {
        let pool = SqlitePoolOptions::new()
            // An in-memory database lives in its connection, so a pool larger
            // than one would hand out empty databases.
            .max_connections(max_connections)
            .connect_with(options)
            .await
            .map_err(storage_err)?;

        sqlx::migrate!("../../database/migrations")
            .run(&pool)
            .await
            .map_err(|e| KyvonError::Storage(format!("migration failed: {e}")))?;

        Ok(Self { pool })
    }

    pub fn pool(&self) -> &sqlx::SqlitePool {
        &self.pool
    }

    /// Size of the database file in bytes, for the developer diagnostics
    /// screen (specification §86).
    pub async fn size_bytes(&self) -> Result<u64> {
        let (page_count, page_size): (i64, i64) = {
            let pc: (i64,) = sqlx::query_as("PRAGMA page_count")
                .fetch_one(&self.pool)
                .await
                .map_err(storage_err)?;
            let ps: (i64,) = sqlx::query_as("PRAGMA page_size")
                .fetch_one(&self.pool)
                .await
                .map_err(storage_err)?;
            (pc.0, ps.0)
        };
        Ok((page_count.max(0) * page_size.max(0)) as u64)
    }

    pub async fn close(&self) {
        self.pool.close().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn migrations_apply_to_a_fresh_database() {
        let db = Database::open_in_memory().await.unwrap();
        let tables: Vec<(String,)> =
            sqlx::query_as("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .fetch_all(db.pool())
                .await
                .unwrap();
        let names: Vec<String> = tables.into_iter().map(|t| t.0).collect();
        for expected in [
            "servers",
            "known_hosts",
            "metric_samples",
            "metric_aggregates",
            "audit_events",
            "notes",
            "saved_commands",
            "snapshots",
            "settings",
        ] {
            assert!(
                names.iter().any(|n| n == expected),
                "table `{expected}` is missing; found {names:?}"
            );
        }
    }

    #[tokio::test]
    async fn foreign_keys_are_enforced() {
        let db = Database::open_in_memory().await.unwrap();
        // A metric for a server that does not exist must be rejected, not
        // silently accepted and left dangling.
        let res = sqlx::query(
            "INSERT INTO metric_samples (server_id, metric, ts, value) VALUES ('nope','cpu.total',1,1.0)",
        )
        .execute(db.pool())
        .await;
        assert!(res.is_err(), "foreign keys are not being enforced");
    }
}
