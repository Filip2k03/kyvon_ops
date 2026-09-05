use kyvon_core::{PortInfo, Result, ServiceInfo, TimestampMs};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::db::{storage_err, Database};

/// A point-in-time record of a host's configuration.
///
/// Explicitly **not** a disk backup (specification §44): it captures what was
/// running and listening, so that "what changed?" has an answer.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotDocument {
    #[serde(default)]
    pub services: Vec<ServiceInfo>,
    #[serde(default)]
    pub ports: Vec<PortInfo>,
    /// `name version` per installed package, when the package manager could
    /// be queried.
    #[serde(default)]
    pub packages: Vec<String>,
    /// `name:tag status` per container.
    #[serde(default)]
    pub containers: Vec<String>,
    /// Login-capable user accounts.
    #[serde(default)]
    pub users: Vec<String>,
    #[serde(default)]
    pub kernel: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub server_id: String,
    pub label: String,
    pub document: SnapshotDocument,
    pub created_at: TimestampMs,
}

/// One difference between two snapshots.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Change {
    /// `service`, `port`, `package`, `container`, `user`, `kernel`.
    pub kind: String,
    /// What changed, e.g. `nginx.service` or `8080/tcp`.
    pub subject: String,
    /// Value in the earlier snapshot; `None` when it did not exist.
    pub previous: Option<String>,
    /// Value in the later snapshot; `None` when it no longer exists.
    pub current: Option<String>,
}

impl Change {
    pub fn is_addition(&self) -> bool {
        self.previous.is_none() && self.current.is_some()
    }
    pub fn is_removal(&self) -> bool {
        self.previous.is_some() && self.current.is_none()
    }
}

/// Compare two snapshots, oldest first.
///
/// Reports only genuine differences: an unchanged service produces no entry,
/// so the result is a change list rather than a full inventory.
pub fn diff(before: &SnapshotDocument, after: &SnapshotDocument) -> Vec<Change> {
    use std::collections::BTreeMap;

    let mut changes = Vec::new();

    let mut compare = |kind: &str, a: BTreeMap<String, String>, b: BTreeMap<String, String>| {
        for (subject, prev) in &a {
            match b.get(subject) {
                Some(curr) if curr == prev => {}
                Some(curr) => changes.push(Change {
                    kind: kind.into(),
                    subject: subject.clone(),
                    previous: Some(prev.clone()),
                    current: Some(curr.clone()),
                }),
                None => changes.push(Change {
                    kind: kind.into(),
                    subject: subject.clone(),
                    previous: Some(prev.clone()),
                    current: None,
                }),
            }
        }
        for (subject, curr) in &b {
            if !a.contains_key(subject) {
                changes.push(Change {
                    kind: kind.into(),
                    subject: subject.clone(),
                    previous: None,
                    current: Some(curr.clone()),
                });
            }
        }
    };

    let services = |d: &SnapshotDocument| -> BTreeMap<String, String> {
        d.services
            .iter()
            .map(|s| (s.unit.clone(), format!("{} ({})", s.active_state, s.sub_state)))
            .collect()
    };
    let ports = |d: &SnapshotDocument| -> BTreeMap<String, String> {
        d.ports
            .iter()
            .map(|p| {
                (
                    format!("{}/{}", p.port, p.protocol),
                    format!(
                        "{} on {}",
                        p.process.clone().unwrap_or_else(|| "unknown process".into()),
                        p.address
                    ),
                )
            })
            .collect()
    };
    let list = |items: &[String]| -> BTreeMap<String, String> {
        items
            .iter()
            .map(|s| {
                let (name, rest) = s.split_once(' ').unwrap_or((s.as_str(), ""));
                (name.to_string(), rest.to_string())
            })
            .collect()
    };

    compare("service", services(before), services(after));
    compare("port", ports(before), ports(after));
    compare("package", list(&before.packages), list(&after.packages));
    compare("container", list(&before.containers), list(&after.containers));
    compare("user", list(&before.users), list(&after.users));

    if before.kernel != after.kernel && !before.kernel.is_empty() {
        changes.push(Change {
            kind: "kernel".into(),
            subject: "running kernel".into(),
            previous: Some(before.kernel.clone()),
            current: Some(after.kernel.clone()),
        });
    }

    changes
}

#[derive(Clone, Debug)]
pub struct SnapshotRepo {
    db: Database,
}

impl SnapshotRepo {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub async fn create(&self, snapshot: &Snapshot) -> Result<()> {
        sqlx::query(
            "INSERT INTO snapshots (id, server_id, label, payload_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(&snapshot.id)
        .bind(&snapshot.server_id)
        .bind(&snapshot.label)
        .bind(serde_json::to_string(&snapshot.document)?)
        .bind(snapshot.created_at)
        .execute(self.db.pool())
        .await
        .map_err(storage_err)?;
        Ok(())
    }

    pub async fn list(&self, server_id: &str) -> Result<Vec<Snapshot>> {
        let rows = sqlx::query(
            "SELECT * FROM snapshots WHERE server_id = ?1 ORDER BY created_at DESC",
        )
        .bind(server_id)
        .fetch_all(self.db.pool())
        .await
        .map_err(storage_err)?;
        rows.into_iter().map(row_to_snapshot).collect()
    }

    pub async fn get(&self, id: &str) -> Result<Option<Snapshot>> {
        let row = sqlx::query("SELECT * FROM snapshots WHERE id = ?1")
            .bind(id)
            .fetch_optional(self.db.pool())
            .await
            .map_err(storage_err)?;
        row.map(row_to_snapshot).transpose()
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM snapshots WHERE id = ?1")
            .bind(id)
            .execute(self.db.pool())
            .await
            .map_err(storage_err)?;
        Ok(())
    }
}

fn row_to_snapshot(r: sqlx::sqlite::SqliteRow) -> Result<Snapshot> {
    let payload: String = r.try_get("payload_json").map_err(storage_err)?;
    Ok(Snapshot {
        id: r.try_get("id").map_err(storage_err)?,
        server_id: r.try_get("server_id").map_err(storage_err)?,
        label: r.try_get("label").map_err(storage_err)?,
        document: serde_json::from_str(&payload)?,
        created_at: r.try_get("created_at").map_err(storage_err)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use kyvon_core::Exposure;

    fn service(unit: &str, active: &str, sub: &str) -> ServiceInfo {
        ServiceInfo {
            unit: unit.into(),
            load_state: "loaded".into(),
            active_state: active.into(),
            sub_state: sub.into(),
            description: String::new(),
            enabled: None,
            active_since_ms: None,
            restarts: None,
        }
    }

    fn port(port: u16, process: &str) -> PortInfo {
        PortInfo {
            port,
            protocol: "tcp".into(),
            address: "0.0.0.0".into(),
            process: Some(process.into()),
            pid: None,
            exposure: Exposure::AllInterfaces,
        }
    }

    #[test]
    fn identical_snapshots_produce_no_changes() {
        let doc = SnapshotDocument {
            services: vec![service("nginx.service", "active", "running")],
            ports: vec![port(443, "nginx")],
            kernel: "6.8.0".into(),
            ..Default::default()
        };
        assert!(diff(&doc, &doc).is_empty());
    }

    #[test]
    fn a_new_listening_port_is_reported_as_an_addition() {
        let before = SnapshotDocument {
            ports: vec![port(443, "nginx")],
            ..Default::default()
        };
        let after = SnapshotDocument {
            ports: vec![port(443, "nginx"), port(8080, "node")],
            ..Default::default()
        };
        let changes = diff(&before, &after);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].subject, "8080/tcp");
        assert!(changes[0].is_addition());
        assert!(changes[0].current.as_ref().unwrap().contains("node"));
    }

    #[test]
    fn a_service_that_stopped_shows_both_states() {
        let before = SnapshotDocument {
            services: vec![service("nginx.service", "active", "running")],
            ..Default::default()
        };
        let after = SnapshotDocument {
            services: vec![service("nginx.service", "failed", "failed")],
            ..Default::default()
        };
        let changes = diff(&before, &after);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].previous.as_deref(), Some("active (running)"));
        assert_eq!(changes[0].current.as_deref(), Some("failed (failed)"));
    }

    #[test]
    fn a_removed_service_is_reported_as_a_removal() {
        let before = SnapshotDocument {
            services: vec![service("old.service", "active", "running")],
            ..Default::default()
        };
        let changes = diff(&before, &SnapshotDocument::default());
        assert_eq!(changes.len(), 1);
        assert!(changes[0].is_removal());
    }

    #[test]
    fn package_upgrades_show_both_versions() {
        let before = SnapshotDocument {
            packages: vec!["nginx 1.24.0".into(), "curl 8.5.0".into()],
            ..Default::default()
        };
        let after = SnapshotDocument {
            packages: vec!["nginx 1.26.2".into(), "curl 8.5.0".into()],
            ..Default::default()
        };
        let changes = diff(&before, &after);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].subject, "nginx");
        assert_eq!(changes[0].previous.as_deref(), Some("1.24.0"));
        assert_eq!(changes[0].current.as_deref(), Some("1.26.2"));
    }

    #[test]
    fn a_kernel_change_is_reported_but_a_first_snapshot_is_not() {
        let before = SnapshotDocument {
            kernel: "6.8.0-51".into(),
            ..Default::default()
        };
        let after = SnapshotDocument {
            kernel: "6.8.0-52".into(),
            ..Default::default()
        };
        assert_eq!(diff(&before, &after).len(), 1);
        // An empty "before" kernel means it was never captured, not that it
        // changed.
        assert!(diff(&SnapshotDocument::default(), &after).is_empty());
    }

    #[tokio::test]
    async fn snapshots_round_trip_through_the_database() {
        use crate::servers::ServerRepo;
        use kyvon_core::{AuthMethod, ServerProfile};

        let db = Database::open_in_memory().await.unwrap();
        ServerRepo::new(db.clone())
            .upsert(&ServerProfile {
                id: "s1".into(),
                alias: "web".into(),
                hostname: "h".into(),
                port: 22,
                username: "u".into(),
                auth: AuthMethod::Agent,
                tags: vec![],
                facts: None,
                created_at: 0,
                updated_at: 0,
            })
            .await
            .unwrap();

        let repo = SnapshotRepo::new(db);
        let snap = Snapshot {
            id: "snap1".into(),
            server_id: "s1".into(),
            label: "before upgrade".into(),
            document: SnapshotDocument {
                services: vec![service("nginx.service", "active", "running")],
                ports: vec![port(443, "nginx")],
                kernel: "6.8.0".into(),
                ..Default::default()
            },
            created_at: 1_770_000_000_000,
        };
        repo.create(&snap).await.unwrap();

        let got = repo.get("snap1").await.unwrap().unwrap();
        assert_eq!(got, snap);
        assert_eq!(repo.list("s1").await.unwrap().len(), 1);
    }
}
