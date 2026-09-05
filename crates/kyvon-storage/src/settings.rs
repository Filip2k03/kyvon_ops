use kyvon_core::Result;
use serde::{de::DeserializeOwned, Serialize};
use sqlx::Row;

use crate::db::{storage_err, Database};

/// Typed key/value application settings.
#[derive(Clone, Debug)]
pub struct SettingsRepo {
    db: Database,
}

impl SettingsRepo {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub async fn set<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        sqlx::query(
            "INSERT INTO settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
        )
        .bind(key)
        .bind(serde_json::to_string(value)?)
        .bind(kyvon_core::now_ms())
        .execute(self.db.pool())
        .await
        .map_err(storage_err)?;
        Ok(())
    }

    /// Read a setting. A stored value that no longer deserialises into `T`
    /// reads as absent rather than as an error, so a schema change to a
    /// setting cannot prevent the application from starting.
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let row = sqlx::query("SELECT value_json FROM settings WHERE key = ?1")
            .bind(key)
            .fetch_optional(self.db.pool())
            .await
            .map_err(storage_err)?;
        let Some(row) = row else { return Ok(None) };
        let json: String = row.try_get("value_json").map_err(storage_err)?;
        Ok(serde_json::from_str(&json).ok())
    }

    pub async fn get_or<T: DeserializeOwned>(&self, key: &str, default: T) -> Result<T> {
        Ok(self.get(key).await?.unwrap_or(default))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn round_trips_typed_values() {
        let r = SettingsRepo::new(Database::open_in_memory().await.unwrap());
        r.set("telemetry.interval_secs", &2u32).await.unwrap();
        assert_eq!(
            r.get::<u32>("telemetry.interval_secs").await.unwrap(),
            Some(2)
        );
    }

    #[tokio::test]
    async fn an_absent_key_yields_the_default() {
        let r = SettingsRepo::new(Database::open_in_memory().await.unwrap());
        assert_eq!(r.get_or("nope", 42u32).await.unwrap(), 42);
    }

    #[tokio::test]
    async fn a_value_of_the_wrong_shape_falls_back_rather_than_failing() {
        let r = SettingsRepo::new(Database::open_in_memory().await.unwrap());
        r.set("interval", &"two seconds").await.unwrap();
        // The setting used to be a string and is now a number: the app must
        // still start.
        assert_eq!(r.get_or("interval", 1u32).await.unwrap(), 1);
    }

    #[tokio::test]
    async fn setting_the_same_key_replaces_it() {
        let r = SettingsRepo::new(Database::open_in_memory().await.unwrap());
        r.set("k", &1u32).await.unwrap();
        r.set("k", &2u32).await.unwrap();
        assert_eq!(r.get::<u32>("k").await.unwrap(), Some(2));
    }
}
