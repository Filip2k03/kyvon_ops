use kyvon_core::{KnownHost, Result};
use sqlx::Row;

use crate::db::{storage_err, Database};

/// The trust store for SSH host keys.
#[derive(Clone, Debug)]
pub struct KnownHostRepo {
    db: Database,
}

/// What the store says about a key the server just presented.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostKeyStatus {
    /// This exact key was trusted before.
    Known,
    /// Nothing has been trusted for this host and port.
    Unknown,
    /// A *different* key was trusted before. Materially more serious than
    /// `Unknown` and presented to the operator as such.
    Changed { previous_fingerprint: String },
}

impl KnownHostRepo {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Compare a presented key against what has been trusted.
    ///
    /// The comparison is on the full public key, not the fingerprint: a
    /// fingerprint is a hash, and pinning the key itself removes any question
    /// of collision from the trust decision.
    pub async fn status(&self, host: &str, port: u16, public_key: &str) -> Result<HostKeyStatus> {
        let row = sqlx::query("SELECT fingerprint, public_key FROM known_hosts WHERE host = ?1 AND port = ?2")
            .bind(host)
            .bind(port as i64)
            .fetch_optional(self.db.pool())
            .await
            .map_err(storage_err)?;

        let Some(row) = row else {
            return Ok(HostKeyStatus::Unknown);
        };
        let stored_key: String = row.try_get("public_key").map_err(storage_err)?;
        if stored_key.trim() == public_key.trim() {
            Ok(HostKeyStatus::Known)
        } else {
            Ok(HostKeyStatus::Changed {
                previous_fingerprint: row.try_get("fingerprint").map_err(storage_err)?,
            })
        }
    }

    /// Record an operator's decision to trust a key.
    ///
    /// Replaces any previous entry for the host and port, which is what makes
    /// "the server was rebuilt" recoverable — but only ever as the result of
    /// an explicit confirmation, never automatically.
    pub async fn trust(&self, host: &KnownHost) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO known_hosts (host, port, key_type, fingerprint, public_key, trusted_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(host, port) DO UPDATE SET
                key_type    = excluded.key_type,
                fingerprint = excluded.fingerprint,
                public_key  = excluded.public_key,
                trusted_at  = excluded.trusted_at
            "#,
        )
        .bind(&host.host)
        .bind(host.port as i64)
        .bind(&host.key_type)
        .bind(&host.fingerprint)
        .bind(&host.public_key)
        .bind(host.trusted_at)
        .execute(self.db.pool())
        .await
        .map_err(storage_err)?;
        Ok(())
    }

    pub async fn list(&self) -> Result<Vec<KnownHost>> {
        let rows = sqlx::query("SELECT * FROM known_hosts ORDER BY host, port")
            .fetch_all(self.db.pool())
            .await
            .map_err(storage_err)?;
        rows.into_iter()
            .map(|r| {
                let port: i64 = r.try_get("port").map_err(storage_err)?;
                Ok(KnownHost {
                    host: r.try_get("host").map_err(storage_err)?,
                    port: port as u16,
                    key_type: r.try_get("key_type").map_err(storage_err)?,
                    fingerprint: r.try_get("fingerprint").map_err(storage_err)?,
                    public_key: r.try_get("public_key").map_err(storage_err)?,
                    trusted_at: r.try_get("trusted_at").map_err(storage_err)?,
                })
            })
            .collect()
    }

    pub async fn forget(&self, host: &str, port: u16) -> Result<()> {
        sqlx::query("DELETE FROM known_hosts WHERE host = ?1 AND port = ?2")
            .bind(host)
            .bind(port as i64)
            .execute(self.db.pool())
            .await
            .map_err(storage_err)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(fp: &str, pk: &str) -> KnownHost {
        KnownHost {
            host: "10.0.0.5".into(),
            port: 22,
            key_type: "ssh-ed25519".into(),
            fingerprint: fp.into(),
            public_key: pk.into(),
            trusted_at: 1_770_000_000_000,
        }
    }

    async fn repo() -> KnownHostRepo {
        KnownHostRepo::new(Database::open_in_memory().await.unwrap())
    }

    #[tokio::test]
    async fn an_unseen_host_is_unknown() {
        let r = repo().await;
        assert_eq!(
            r.status("10.0.0.5", 22, "ssh-ed25519 AAAA").await.unwrap(),
            HostKeyStatus::Unknown
        );
    }

    #[tokio::test]
    async fn a_trusted_key_is_recognised() {
        let r = repo().await;
        r.trust(&key("SHA256:abc", "ssh-ed25519 AAAA")).await.unwrap();
        assert_eq!(
            r.status("10.0.0.5", 22, "ssh-ed25519 AAAA").await.unwrap(),
            HostKeyStatus::Known
        );
    }

    #[tokio::test]
    async fn a_different_key_is_reported_as_a_change_not_as_unknown() {
        let r = repo().await;
        r.trust(&key("SHA256:abc", "ssh-ed25519 AAAA")).await.unwrap();
        match r.status("10.0.0.5", 22, "ssh-ed25519 BBBB").await.unwrap() {
            HostKeyStatus::Changed {
                previous_fingerprint,
            } => assert_eq!(previous_fingerprint, "SHA256:abc"),
            other => panic!("a changed key must not be reported as {other:?}"),
        }
    }

    #[tokio::test]
    async fn the_same_host_on_another_port_is_a_separate_identity() {
        let r = repo().await;
        r.trust(&key("SHA256:abc", "ssh-ed25519 AAAA")).await.unwrap();
        let mut other_port = key("SHA256:abc", "ssh-ed25519 AAAA");
        other_port.port = 2222;
        assert_eq!(
            r.status("10.0.0.5", 2222, "ssh-ed25519 AAAA").await.unwrap(),
            HostKeyStatus::Unknown
        );
        r.trust(&other_port).await.unwrap();
        assert_eq!(r.list().await.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn re_trusting_replaces_the_previous_key() {
        let r = repo().await;
        r.trust(&key("SHA256:abc", "ssh-ed25519 AAAA")).await.unwrap();
        r.trust(&key("SHA256:xyz", "ssh-ed25519 BBBB")).await.unwrap();
        assert_eq!(r.list().await.unwrap().len(), 1);
        assert_eq!(
            r.status("10.0.0.5", 22, "ssh-ed25519 BBBB").await.unwrap(),
            HostKeyStatus::Known
        );
    }

    #[tokio::test]
    async fn forgetting_a_host_returns_it_to_unknown() {
        let r = repo().await;
        r.trust(&key("SHA256:abc", "ssh-ed25519 AAAA")).await.unwrap();
        r.forget("10.0.0.5", 22).await.unwrap();
        assert_eq!(
            r.status("10.0.0.5", 22, "ssh-ed25519 AAAA").await.unwrap(),
            HostKeyStatus::Unknown
        );
    }
}
