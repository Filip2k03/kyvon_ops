use kyvon_core::{KyvonError, Result, TimestampMs};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::db::{storage_err, Database};

/// A Markdown note attached to a server (specification §50).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub server_id: String,
    pub section: String,
    pub title: String,
    pub body_md: String,
    pub created_at: TimestampMs,
    pub updated_at: TimestampMs,
}

/// The sections an operations notebook is divided into.
pub const SECTIONS: &[&str] = &[
    "architecture",
    "deployment",
    "backup",
    "maintenance",
    "known-issues",
    "commands",
    "operational",
    "incidents",
];

#[derive(Clone, Debug)]
pub struct NoteRepo {
    db: Database,
}

impl NoteRepo {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub async fn upsert(&self, note: &Note) -> Result<()> {
        if note.title.trim().is_empty() {
            return Err(KyvonError::Invalid("a note needs a title".into()));
        }
        if !SECTIONS.contains(&note.section.as_str()) {
            return Err(KyvonError::Invalid(format!(
                "`{}` is not a notebook section; expected one of {}",
                note.section,
                SECTIONS.join(", ")
            )));
        }
        let now = kyvon_core::now_ms();
        sqlx::query(
            r#"
            INSERT INTO notes (id, server_id, section, title, body_md, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(id) DO UPDATE SET
                section    = excluded.section,
                title      = excluded.title,
                body_md    = excluded.body_md,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&note.id)
        .bind(&note.server_id)
        .bind(&note.section)
        .bind(&note.title)
        .bind(&note.body_md)
        .bind(if note.created_at > 0 { note.created_at } else { now })
        .bind(now)
        .execute(self.db.pool())
        .await
        .map_err(storage_err)?;
        Ok(())
    }

    pub async fn list(&self, server_id: &str) -> Result<Vec<Note>> {
        let rows = sqlx::query(
            "SELECT * FROM notes WHERE server_id = ?1 ORDER BY section, updated_at DESC",
        )
        .bind(server_id)
        .fetch_all(self.db.pool())
        .await
        .map_err(storage_err)?;

        rows.into_iter()
            .map(|r| {
                Ok(Note {
                    id: r.try_get("id").map_err(storage_err)?,
                    server_id: r.try_get("server_id").map_err(storage_err)?,
                    section: r.try_get("section").map_err(storage_err)?,
                    title: r.try_get("title").map_err(storage_err)?,
                    body_md: r.try_get("body_md").map_err(storage_err)?,
                    created_at: r.try_get("created_at").map_err(storage_err)?,
                    updated_at: r.try_get("updated_at").map_err(storage_err)?,
                })
            })
            .collect()
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM notes WHERE id = ?1")
            .bind(id)
            .execute(self.db.pool())
            .await
            .map_err(storage_err)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::servers::ServerRepo;
    use kyvon_core::{AuthMethod, ServerProfile};

    async fn setup() -> NoteRepo {
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
        NoteRepo::new(db)
    }

    fn note(id: &str, section: &str, title: &str) -> Note {
        Note {
            id: id.into(),
            server_id: "s1".into(),
            section: section.into(),
            title: title.into(),
            body_md: "## Steps\n1. do the thing\n".into(),
            created_at: 0,
            updated_at: 0,
        }
    }

    #[tokio::test]
    async fn stores_and_lists_notes() {
        let r = setup().await;
        r.upsert(&note("n1", "deployment", "How we deploy")).await.unwrap();
        let got = r.list("s1").await.unwrap();
        assert_eq!(got.len(), 1);
        assert!(got[0].body_md.contains("do the thing"));
    }

    #[tokio::test]
    async fn editing_keeps_the_creation_time_and_moves_the_update_time() {
        let r = setup().await;
        r.upsert(&note("n1", "deployment", "v1")).await.unwrap();
        let first = r.list("s1").await.unwrap()[0].clone();

        let mut edited = first.clone();
        edited.title = "v2".into();
        r.upsert(&edited).await.unwrap();

        let second = r.list("s1").await.unwrap()[0].clone();
        assert_eq!(second.created_at, first.created_at);
        assert_eq!(second.title, "v2");
    }

    #[tokio::test]
    async fn rejects_an_unknown_section() {
        let r = setup().await;
        let err = r.upsert(&note("n1", "misc", "x")).await.unwrap_err();
        assert!(err.to_string().contains("not a notebook section"));
    }

    #[tokio::test]
    async fn rejects_an_untitled_note() {
        let r = setup().await;
        assert!(r.upsert(&note("n1", "deployment", "   ")).await.is_err());
    }

    #[tokio::test]
    async fn notes_are_removed_with_their_server() {
        let db = Database::open_in_memory().await.unwrap();
        let servers = ServerRepo::new(db.clone());
        servers
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
        let notes = NoteRepo::new(db);
        notes.upsert(&note("n1", "backup", "Backups")).await.unwrap();
        servers.delete("s1").await.unwrap();
        assert!(notes.list("s1").await.unwrap().is_empty());
    }
}
