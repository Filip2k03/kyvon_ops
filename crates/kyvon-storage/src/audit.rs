use kyvon_core::{redact, Result, RiskTier, TimestampMs};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::db::{storage_err, Database};

/// How an operation ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Success,
    Failure,
    /// The operator saw the confirmation and declined.
    Cancelled,
}

impl Outcome {
    fn as_str(self) -> &'static str {
        match self {
            Outcome::Success => "success",
            Outcome::Failure => "failure",
            Outcome::Cancelled => "cancelled",
        }
    }

    fn parse(s: &str) -> Self {
        match s {
            "success" => Outcome::Success,
            "cancelled" => Outcome::Cancelled,
            _ => Outcome::Failure,
        }
    }
}

/// One entry in the local audit ledger (specification §38).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    #[serde(default)]
    pub server_id: Option<String>,
    pub category: String,
    pub summary: String,
    #[serde(default)]
    pub command: Option<String>,
    pub risk_tier: RiskTier,
    pub outcome: Outcome,
    #[serde(default)]
    pub exit_status: Option<i64>,
    #[serde(default)]
    pub duration_ms: Option<i64>,
    #[serde(default)]
    pub result_excerpt: Option<String>,
    pub created_at: TimestampMs,
}

impl AuditEvent {
    /// Build an entry, generating the id and timestamp.
    pub fn new(
        server_id: Option<String>,
        category: &str,
        summary: impl Into<String>,
        risk_tier: RiskTier,
        outcome: Outcome,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            server_id,
            category: category.to_string(),
            summary: summary.into(),
            command: None,
            risk_tier,
            outcome,
            exit_status: None,
            duration_ms: None,
            result_excerpt: None,
            created_at: kyvon_core::now_ms(),
        }
    }

    pub fn with_command(mut self, command: impl Into<String>) -> Self {
        self.command = Some(command.into());
        self
    }

    pub fn with_result(
        mut self,
        exit_status: Option<u32>,
        excerpt: &str,
        duration_ms: u64,
    ) -> Self {
        self.exit_status = exit_status.map(|s| s as i64);
        self.duration_ms = Some(duration_ms as i64);
        self.result_excerpt = Some(excerpt.chars().take(2000).collect());
        self
    }
}

/// The append-only ledger of what KyvonOPS did.
#[derive(Clone, Debug)]
pub struct AuditRepo {
    db: Database,
}

impl AuditRepo {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Record an event.
    ///
    /// The summary, command and result excerpt are passed through secret
    /// redaction *here* rather than at every call site, so a new caller cannot
    /// forget and write a password into the ledger.
    pub async fn record(&self, event: &AuditEvent) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO audit_events
                (id, server_id, category, summary, command, risk_tier, outcome,
                 exit_status, duration_ms, result_excerpt, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
        )
        .bind(&event.id)
        .bind(&event.server_id)
        .bind(&event.category)
        .bind(redact(&event.summary))
        .bind(event.command.as_deref().map(redact))
        .bind(event.risk_tier.as_str())
        .bind(event.outcome.as_str())
        .bind(event.exit_status)
        .bind(event.duration_ms)
        .bind(event.result_excerpt.as_deref().map(redact))
        .bind(event.created_at)
        .execute(self.db.pool())
        .await
        .map_err(storage_err)?;
        Ok(())
    }

    /// Most recent events, newest first.
    pub async fn recent(&self, server_id: Option<&str>, limit: u32) -> Result<Vec<AuditEvent>> {
        let limit = limit.clamp(1, 1000) as i64;
        let rows = match server_id {
            Some(id) => sqlx::query(
                "SELECT * FROM audit_events WHERE server_id = ?1 ORDER BY created_at DESC LIMIT ?2",
            )
            .bind(id)
            .bind(limit)
            .fetch_all(self.db.pool())
            .await,
            None => {
                sqlx::query("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?1")
                    .bind(limit)
                    .fetch_all(self.db.pool())
                    .await
            }
        }
        .map_err(storage_err)?;

        rows.into_iter()
            .map(|r| {
                let tier: String = r.try_get("risk_tier").map_err(storage_err)?;
                let outcome: String = r.try_get("outcome").map_err(storage_err)?;
                Ok(AuditEvent {
                    id: r.try_get("id").map_err(storage_err)?,
                    server_id: r.try_get("server_id").map_err(storage_err)?,
                    category: r.try_get("category").map_err(storage_err)?,
                    summary: r.try_get("summary").map_err(storage_err)?,
                    command: r.try_get("command").map_err(storage_err)?,
                    risk_tier: parse_tier(&tier),
                    outcome: Outcome::parse(&outcome),
                    exit_status: r.try_get("exit_status").map_err(storage_err)?,
                    duration_ms: r.try_get("duration_ms").map_err(storage_err)?,
                    result_excerpt: r.try_get("result_excerpt").map_err(storage_err)?,
                    created_at: r.try_get("created_at").map_err(storage_err)?,
                })
            })
            .collect()
    }

    pub async fn count(&self) -> Result<u64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM audit_events")
            .fetch_one(self.db.pool())
            .await
            .map_err(storage_err)?;
        Ok(row.0 as u64)
    }
}

fn parse_tier(s: &str) -> RiskTier {
    match s {
        "safe" => RiskTier::Safe,
        "low" => RiskTier::Low,
        "medium" => RiskTier::Medium,
        "high" => RiskTier::High,
        // An unrecognised tier is treated as the most serious, never the least.
        _ => RiskTier::Critical,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn repo() -> AuditRepo {
        AuditRepo::new(Database::open_in_memory().await.unwrap())
    }

    #[tokio::test]
    async fn records_and_reads_back_an_event() {
        let r = repo().await;
        let e = AuditEvent::new(
            None,
            "exec",
            "restart nginx",
            RiskTier::Medium,
            Outcome::Success,
        )
        .with_command("systemctl restart nginx")
        .with_result(Some(0), "", 412);
        r.record(&e).await.unwrap();

        let got = &r.recent(None, 10).await.unwrap()[0];
        assert_eq!(got.summary, "restart nginx");
        assert_eq!(got.risk_tier, RiskTier::Medium);
        assert_eq!(got.outcome, Outcome::Success);
        assert_eq!(got.duration_ms, Some(412));
    }

    #[tokio::test]
    async fn secrets_never_enter_the_ledger() {
        let r = repo().await;
        r.record(
            &AuditEvent::new(
                None,
                "exec",
                "connect to db",
                RiskTier::Low,
                Outcome::Success,
            )
            .with_command("psql postgres://app:hunter2@db:5432/prod")
            .with_result(Some(0), "PGPASSWORD=swordfish accepted", 10),
        )
        .await
        .unwrap();

        let got = &r.recent(None, 1).await.unwrap()[0];
        assert!(
            !got.command.as_ref().unwrap().contains("hunter2"),
            "{got:?}"
        );
        assert!(
            !got.result_excerpt.as_ref().unwrap().contains("swordfish"),
            "{got:?}"
        );
    }

    #[tokio::test]
    async fn newest_events_come_first() {
        let r = repo().await;
        for i in 0..5 {
            let mut e = AuditEvent::new(
                None,
                "exec",
                format!("command {i}"),
                RiskTier::Safe,
                Outcome::Success,
            );
            e.created_at = 1_770_000_000_000 + i as i64;
            r.record(&e).await.unwrap();
        }
        let got = r.recent(None, 10).await.unwrap();
        assert_eq!(got[0].summary, "command 4");
        assert_eq!(got[4].summary, "command 0");
    }

    #[tokio::test]
    async fn a_declined_operation_is_still_recorded() {
        // Knowing what was *not* run matters as much as knowing what was.
        let r = repo().await;
        r.record(&AuditEvent::new(
            None,
            "exec",
            "reboot production-01",
            RiskTier::Critical,
            Outcome::Cancelled,
        ))
        .await
        .unwrap();
        assert_eq!(
            r.recent(None, 1).await.unwrap()[0].outcome,
            Outcome::Cancelled
        );
    }

    #[tokio::test]
    async fn an_unreadable_tier_reads_back_as_critical_not_safe() {
        assert_eq!(parse_tier("nonsense"), RiskTier::Critical);
        assert_eq!(parse_tier("safe"), RiskTier::Safe);
    }

    #[tokio::test]
    async fn the_result_excerpt_is_bounded() {
        let r = repo().await;
        let huge = "x".repeat(100_000);
        r.record(
            &AuditEvent::new(None, "exec", "cat big", RiskTier::Safe, Outcome::Success)
                .with_result(Some(0), &huge, 1),
        )
        .await
        .unwrap();
        let got = &r.recent(None, 1).await.unwrap()[0];
        assert!(got.result_excerpt.as_ref().unwrap().len() <= 2000);
    }
}
