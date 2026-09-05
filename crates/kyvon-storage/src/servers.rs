use kyvon_core::{AuthMethod, HostFacts, KyvonError, Result, ServerProfile};
use sqlx::Row;

use crate::db::{storage_err, Database};

/// Persistence for the server inventory.
#[derive(Clone, Debug)]
pub struct ServerRepo {
    db: Database,
}

impl ServerRepo {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Insert or update a profile.
    ///
    /// Validation runs here, not only in the UI: the frontend is untrusted and
    /// must not be able to persist a profile that would produce a malformed
    /// connection (specification §96).
    pub async fn upsert(&self, profile: &ServerProfile) -> Result<()> {
        profile.validate()?;
        let now = kyvon_core::now_ms();
        let created = if profile.created_at > 0 {
            profile.created_at
        } else {
            now
        };

        sqlx::query(
            r#"
            INSERT INTO servers (id, alias, hostname, port, username, auth_json, tags_json, facts_json, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
                alias      = excluded.alias,
                hostname   = excluded.hostname,
                port       = excluded.port,
                username   = excluded.username,
                auth_json  = excluded.auth_json,
                tags_json  = excluded.tags_json,
                facts_json = COALESCE(excluded.facts_json, servers.facts_json),
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&profile.id)
        .bind(&profile.alias)
        .bind(&profile.hostname)
        .bind(profile.port as i64)
        .bind(&profile.username)
        .bind(serde_json::to_string(&profile.auth)?)
        .bind(serde_json::to_string(&profile.tags)?)
        .bind(
            profile
                .facts
                .as_ref()
                .map(serde_json::to_string)
                .transpose()?,
        )
        .bind(created)
        .bind(now)
        .execute(self.db.pool())
        .await
        .map_err(|e| match &e {
            sqlx::Error::Database(dbe) if dbe.message().contains("idx_servers_alias") => {
                KyvonError::Invalid(format!(
                    "another server is already named `{}` — names must be unique",
                    profile.alias
                ))
            }
            _ => storage_err(e),
        })?;
        Ok(())
    }

    pub async fn get(&self, id: &str) -> Result<Option<ServerProfile>> {
        let row = sqlx::query("SELECT * FROM servers WHERE id = ?1")
            .bind(id)
            .fetch_optional(self.db.pool())
            .await
            .map_err(storage_err)?;
        row.map(row_to_profile).transpose()
    }

    /// Like [`Self::get`], but a missing server is an error rather than
    /// `None`. Used by every command that takes a server id from the
    /// frontend, so an unknown id is rejected at the boundary.
    pub async fn require(&self, id: &str) -> Result<ServerProfile> {
        self.get(id)
            .await?
            .ok_or_else(|| KyvonError::UnknownServer(id.to_string()))
    }

    pub async fn list(&self) -> Result<Vec<ServerProfile>> {
        let rows = sqlx::query("SELECT * FROM servers ORDER BY alias COLLATE NOCASE")
            .fetch_all(self.db.pool())
            .await
            .map_err(storage_err)?;
        rows.into_iter().map(row_to_profile).collect()
    }

    /// Record what a capability probe learned.
    pub async fn set_facts(&self, id: &str, facts: &HostFacts) -> Result<()> {
        let n = sqlx::query("UPDATE servers SET facts_json = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(id)
            .bind(serde_json::to_string(facts)?)
            .bind(kyvon_core::now_ms())
            .execute(self.db.pool())
            .await
            .map_err(storage_err)?
            .rows_affected();
        if n == 0 {
            return Err(KyvonError::UnknownServer(id.to_string()));
        }
        Ok(())
    }

    /// Remove a server and everything that cascades from it.
    ///
    /// The caller is responsible for clearing the server's keychain entries;
    /// this repository has no access to them by design.
    pub async fn delete(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM servers WHERE id = ?1")
            .bind(id)
            .execute(self.db.pool())
            .await
            .map_err(storage_err)?;
        Ok(())
    }
}

fn row_to_profile(row: sqlx::sqlite::SqliteRow) -> Result<ServerProfile> {
    let auth_json: String = row.try_get("auth_json").map_err(storage_err)?;
    let tags_json: String = row.try_get("tags_json").map_err(storage_err)?;
    let facts_json: Option<String> = row.try_get("facts_json").map_err(storage_err)?;
    let port: i64 = row.try_get("port").map_err(storage_err)?;

    Ok(ServerProfile {
        id: row.try_get("id").map_err(storage_err)?,
        alias: row.try_get("alias").map_err(storage_err)?,
        hostname: row.try_get("hostname").map_err(storage_err)?,
        port: port as u16,
        username: row.try_get("username").map_err(storage_err)?,
        auth: serde_json::from_str::<AuthMethod>(&auth_json)?,
        tags: serde_json::from_str(&tags_json)?,
        facts: facts_json
            .map(|f| serde_json::from_str::<HostFacts>(&f))
            .transpose()?,
        created_at: row.try_get("created_at").map_err(storage_err)?,
        updated_at: row.try_get("updated_at").map_err(storage_err)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(id: &str, alias: &str) -> ServerProfile {
        ServerProfile {
            id: id.into(),
            alias: alias.into(),
            hostname: "10.0.0.5".into(),
            port: 22,
            username: "deploy".into(),
            auth: AuthMethod::Agent,
            tags: vec!["production".into()],
            facts: None,
            created_at: 0,
            updated_at: 0,
        }
    }

    async fn repo() -> ServerRepo {
        ServerRepo::new(Database::open_in_memory().await.unwrap())
    }

    #[tokio::test]
    async fn round_trips_a_profile() {
        let r = repo().await;
        r.upsert(&profile("s1", "production-01")).await.unwrap();
        let got = r.get("s1").await.unwrap().unwrap();
        assert_eq!(got.alias, "production-01");
        assert_eq!(got.auth, AuthMethod::Agent);
        assert_eq!(got.tags, vec!["production".to_string()]);
        assert!(got.created_at > 0, "created_at should be stamped on insert");
    }

    #[tokio::test]
    async fn upsert_preserves_the_creation_time() {
        let r = repo().await;
        r.upsert(&profile("s1", "production-01")).await.unwrap();
        let first = r.get("s1").await.unwrap().unwrap();

        let mut edited = first.clone();
        edited.alias = "production-01-renamed".into();
        r.upsert(&edited).await.unwrap();

        let second = r.get("s1").await.unwrap().unwrap();
        assert_eq!(second.created_at, first.created_at);
        assert_eq!(second.alias, "production-01-renamed");
    }

    #[tokio::test]
    async fn facts_survive_a_profile_edit() {
        let r = repo().await;
        r.upsert(&profile("s1", "web")).await.unwrap();
        let facts = HostFacts {
            os_id: "ubuntu".into(),
            arch: "x86_64".into(),
            ..Default::default()
        };
        r.set_facts("s1", &facts).await.unwrap();

        // Editing the connection details must not discard what we learned.
        let mut edited = r.get("s1").await.unwrap().unwrap();
        edited.facts = None;
        edited.port = 2222;
        r.upsert(&edited).await.unwrap();

        let got = r.get("s1").await.unwrap().unwrap();
        assert_eq!(got.port, 2222);
        assert_eq!(got.facts.unwrap().os_id, "ubuntu");
    }

    #[tokio::test]
    async fn duplicate_aliases_are_rejected_with_a_readable_message() {
        let r = repo().await;
        r.upsert(&profile("s1", "web")).await.unwrap();
        let err = r.upsert(&profile("s2", "web")).await.unwrap_err();
        assert!(
            err.to_string().contains("already named"),
            "unhelpful error: {err}"
        );
    }

    #[tokio::test]
    async fn invalid_profiles_never_reach_the_database() {
        let r = repo().await;
        let mut bad = profile("s1", "web");
        bad.hostname = "".into();
        assert!(r.upsert(&bad).await.is_err());

        let mut injected = profile("s2", "web2");
        injected.username = "root; rm -rf /".into();
        assert!(r.upsert(&injected).await.is_err());

        assert!(r.list().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn require_names_the_missing_server() {
        let r = repo().await;
        match r.require("ghost").await {
            Err(KyvonError::UnknownServer(id)) => assert_eq!(id, "ghost"),
            other => panic!("expected UnknownServer, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn listing_is_ordered_case_insensitively() {
        let r = repo().await;
        for (i, alias) in ["zeta", "Alpha", "middle"].iter().enumerate() {
            r.upsert(&profile(&format!("s{i}"), alias)).await.unwrap();
        }
        let aliases: Vec<String> = r.list().await.unwrap().into_iter().map(|s| s.alias).collect();
        assert_eq!(aliases, vec!["Alpha", "middle", "zeta"]);
    }

    #[tokio::test]
    async fn deleting_a_server_removes_its_history() {
        let r = repo().await;
        r.upsert(&profile("s1", "web")).await.unwrap();
        sqlx::query("INSERT INTO metric_samples (server_id, metric, ts, value) VALUES ('s1','cpu.total',1,50.0)")
            .execute(r.db.pool())
            .await
            .unwrap();

        r.delete("s1").await.unwrap();

        let remaining: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM metric_samples")
            .fetch_one(r.db.pool())
            .await
            .unwrap();
        assert_eq!(remaining.0, 0, "cascade should have removed the samples");
    }
}
