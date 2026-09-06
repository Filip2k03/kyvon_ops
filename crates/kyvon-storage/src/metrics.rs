use kyvon_core::{MetricAggregate, Resolution, Result, TimestampMs};
use sqlx::Row;

use crate::db::{storage_err, Database};

/// Telemetry history: raw samples, rollups and retention.
#[derive(Clone, Debug)]
pub struct MetricRepo {
    db: Database,
}

/// One point on a chart.
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Point {
    pub ts: TimestampMs,
    pub value: f64,
}

impl MetricRepo {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Write a batch of samples in one transaction.
    ///
    /// Telemetry arrives every second across every connected server; one
    /// transaction per sample would mean an fsync per second per server. The
    /// caller batches a whole frame's metrics into a single call.
    pub async fn insert_samples(
        &self,
        server_id: &str,
        samples: &[(String, TimestampMs, f64)],
    ) -> Result<()> {
        if samples.is_empty() {
            return Ok(());
        }
        let mut tx = self.db.pool().begin().await.map_err(storage_err)?;
        for (metric, ts, value) in samples {
            // A duplicate (server, metric, ts) means the same instant was
            // reported twice; keeping the later value is correct and avoids
            // failing the whole batch.
            sqlx::query(
                "INSERT INTO metric_samples (server_id, metric, ts, value) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(server_id, metric, ts) DO UPDATE SET value = excluded.value",
            )
            .bind(server_id)
            .bind(metric)
            .bind(ts)
            .bind(value)
            .execute(&mut *tx)
            .await
            .map_err(storage_err)?;
        }
        tx.commit().await.map_err(storage_err)
    }

    /// Read a series for a chart.
    ///
    /// Picks raw samples or a rollup based on the window, so a 30-day chart
    /// does not try to draw 2.6 million points.
    pub async fn series(
        &self,
        server_id: &str,
        metric: &str,
        from: TimestampMs,
        to: TimestampMs,
    ) -> Result<Vec<Point>> {
        let resolution = Resolution::for_window(to - from);
        if resolution == Resolution::Raw {
            let rows = sqlx::query(
                "SELECT ts, value FROM metric_samples
                 WHERE server_id = ?1 AND metric = ?2 AND ts BETWEEN ?3 AND ?4
                 ORDER BY ts",
            )
            .bind(server_id)
            .bind(metric)
            .bind(from)
            .bind(to)
            .fetch_all(self.db.pool())
            .await
            .map_err(storage_err)?;
            return rows
                .into_iter()
                .map(|r| {
                    Ok(Point {
                        ts: r.try_get("ts").map_err(storage_err)?,
                        value: r.try_get("value").map_err(storage_err)?,
                    })
                })
                .collect();
        }

        let rows = sqlx::query(
            "SELECT bucket_start, avg FROM metric_aggregates
             WHERE server_id = ?1 AND metric = ?2 AND resolution = ?3 AND bucket_start BETWEEN ?4 AND ?5
             ORDER BY bucket_start",
        )
        .bind(server_id)
        .bind(metric)
        .bind(resolution.as_str())
        .bind(from)
        .bind(to)
        .fetch_all(self.db.pool())
        .await
        .map_err(storage_err)?;

        rows.into_iter()
            .map(|r| {
                Ok(Point {
                    ts: r.try_get("bucket_start").map_err(storage_err)?,
                    value: r.try_get("avg").map_err(storage_err)?,
                })
            })
            .collect()
    }

    /// Which metrics this server has any history for.
    /// The newest recorded sample of every metric for a server, whatever its
    /// age, as `(metric, ts, value)`.
    ///
    /// One statement rather than one per metric: listing the distinct keys and
    /// then querying each cost a round trip per key, so a collector emitting
    /// sixty of them made a single health call sixty-one sequential queries.
    ///
    /// Age is not filtered here. "Nothing was ever collected" and "nothing was
    /// collected recently" are different facts, and a caller cannot recover the
    /// distinction once this has discarded it — so the timestamp is returned
    /// and the judgement left to whoever is answering the question.
    pub async fn latest_per_metric(
        &self,
        server_id: &str,
    ) -> Result<Vec<(String, TimestampMs, f64)>> {
        let rows = sqlx::query(
            "SELECT metric, MAX(ts) AS ts, value
             FROM metric_samples
             WHERE server_id = ?1
             GROUP BY metric
             ORDER BY metric",
        )
        .bind(server_id)
        .fetch_all(self.db.pool())
        .await
        .map_err(storage_err)?;

        rows.into_iter()
            .map(|r| {
                Ok((
                    r.try_get("metric").map_err(storage_err)?,
                    r.try_get("ts").map_err(storage_err)?,
                    r.try_get("value").map_err(storage_err)?,
                ))
            })
            .collect()
    }

    pub async fn known_metrics(&self, server_id: &str) -> Result<Vec<String>> {
        let rows = sqlx::query(
            "SELECT DISTINCT metric FROM metric_samples WHERE server_id = ?1 ORDER BY metric",
        )
        .bind(server_id)
        .fetch_all(self.db.pool())
        .await
        .map_err(storage_err)?;
        rows.into_iter()
            .map(|r| r.try_get::<String, _>("metric").map_err(storage_err))
            .collect()
    }

    /// Fold raw samples older than `before` into buckets at `resolution`.
    ///
    /// Idempotent: re-running over the same window recomputes the same
    /// buckets rather than doubling them, so a crash mid-rollup is harmless.
    pub async fn roll_up(&self, resolution: Resolution, before: TimestampMs) -> Result<u64> {
        let width = resolution.bucket_ms();
        if width <= 0 {
            return Ok(0);
        }
        // SQLite has no percentile function, so p95 is computed as the value
        // at the 95th-percentile rank within each bucket using a window
        // function — an observed sample, not an interpolation.
        let affected = sqlx::query(
            r#"
            INSERT INTO metric_aggregates
                (server_id, metric, resolution, bucket_start, avg, min, max, p95, samples)
            SELECT
                server_id,
                metric,
                ?1 AS resolution,
                bucket_start,
                AVG(value),
                MIN(value),
                MAX(value),
                MAX(CASE WHEN rank_in_bucket <= p95_rank THEN value END),
                COUNT(*)
            FROM (
                SELECT
                    server_id,
                    metric,
                    value,
                    ts - (ts % ?2) AS bucket_start,
                    ROW_NUMBER() OVER (
                        PARTITION BY server_id, metric, ts - (ts % ?2) ORDER BY value
                    ) AS rank_in_bucket,
                    CAST(
                        (COUNT(*) OVER (PARTITION BY server_id, metric, ts - (ts % ?2)) * 95 + 99) / 100
                        AS INTEGER
                    ) AS p95_rank
                FROM metric_samples
                WHERE ts < ?3
            )
            GROUP BY server_id, metric, bucket_start
            ON CONFLICT(server_id, metric, resolution, bucket_start) DO UPDATE SET
                avg     = excluded.avg,
                min     = excluded.min,
                max     = excluded.max,
                p95     = excluded.p95,
                samples = excluded.samples
            "#,
        )
        .bind(resolution.as_str())
        .bind(width)
        .bind(before)
        .execute(self.db.pool())
        .await
        .map_err(storage_err)?
        .rows_affected();
        Ok(affected)
    }

    /// Delete data past its retention window.
    ///
    /// Returns the number of rows removed, so the diagnostics screen can show
    /// that retention is actually running.
    pub async fn prune(&self, now: TimestampMs) -> Result<u64> {
        let mut removed = sqlx::query("DELETE FROM metric_samples WHERE ts < ?1")
            .bind(now - Resolution::Raw.retention_ms())
            .execute(self.db.pool())
            .await
            .map_err(storage_err)?
            .rows_affected();

        for res in [
            Resolution::OneMinute,
            Resolution::FiveMinute,
            Resolution::Hourly,
        ] {
            removed += sqlx::query(
                "DELETE FROM metric_aggregates WHERE resolution = ?1 AND bucket_start < ?2",
            )
            .bind(res.as_str())
            .bind(now - res.retention_ms())
            .execute(self.db.pool())
            .await
            .map_err(storage_err)?
            .rows_affected();
        }
        Ok(removed)
    }

    /// Read a bucket directly. Used by tests and the diagnostics screen.
    pub async fn aggregate(
        &self,
        server_id: &str,
        metric: &str,
        resolution: Resolution,
        bucket_start: TimestampMs,
    ) -> Result<Option<MetricAggregate>> {
        let row = sqlx::query(
            "SELECT bucket_start, avg, min, max, p95, samples FROM metric_aggregates
             WHERE server_id = ?1 AND metric = ?2 AND resolution = ?3 AND bucket_start = ?4",
        )
        .bind(server_id)
        .bind(metric)
        .bind(resolution.as_str())
        .bind(bucket_start)
        .fetch_optional(self.db.pool())
        .await
        .map_err(storage_err)?;

        row.map(|r| {
            let samples: i64 = r.try_get("samples").map_err(storage_err)?;
            Ok(MetricAggregate {
                bucket_start_ms: r.try_get("bucket_start").map_err(storage_err)?,
                avg: r.try_get("avg").map_err(storage_err)?,
                min: r.try_get("min").map_err(storage_err)?,
                max: r.try_get("max").map_err(storage_err)?,
                p95: r.try_get("p95").map_err(storage_err)?,
                samples: samples as u32,
            })
        })
        .transpose()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::servers::ServerRepo;
    use kyvon_core::{AuthMethod, ServerProfile};

    const T0: TimestampMs = 1_770_000_000_000;

    async fn repo_with_server() -> (MetricRepo, Database) {
        let db = Database::open_in_memory().await.unwrap();
        ServerRepo::new(db.clone())
            .upsert(&ServerProfile {
                id: "s1".into(),
                alias: "web".into(),
                hostname: "10.0.0.5".into(),
                port: 22,
                username: "deploy".into(),
                auth: AuthMethod::Agent,
                tags: vec![],
                facts: None,
                created_at: 0,
                updated_at: 0,
            })
            .await
            .unwrap();
        (MetricRepo::new(db.clone()), db)
    }

    #[tokio::test]
    async fn stores_and_reads_back_a_series() {
        let (r, _db) = repo_with_server().await;
        let samples: Vec<_> = (0..10)
            .map(|i| ("cpu.total".to_string(), T0 + i * 1000, i as f64))
            .collect();
        r.insert_samples("s1", &samples).await.unwrap();

        let series = r.series("s1", "cpu.total", T0, T0 + 10_000).await.unwrap();
        assert_eq!(series.len(), 10);
        assert_eq!(series[0].value, 0.0);
        assert_eq!(series[9].value, 9.0);
        // Ordering matters: a chart drawn from unordered points zig-zags.
        assert!(series.windows(2).all(|w| w[0].ts < w[1].ts));
    }

    #[tokio::test]
    async fn a_repeated_timestamp_updates_rather_than_failing_the_batch() {
        let (r, _db) = repo_with_server().await;
        r.insert_samples("s1", &[("cpu.total".into(), T0, 10.0)])
            .await
            .unwrap();
        r.insert_samples("s1", &[("cpu.total".into(), T0, 20.0)])
            .await
            .unwrap();
        let series = r.series("s1", "cpu.total", T0, T0 + 1000).await.unwrap();
        assert_eq!(series.len(), 1);
        assert_eq!(series[0].value, 20.0);
    }

    #[tokio::test]
    async fn rolls_raw_samples_into_minute_buckets() {
        let (r, _db) = repo_with_server().await;
        // Two minutes of samples: 0..59 = 10.0, 60..119 = 20.0, plus a spike.
        let mut samples: Vec<(String, TimestampMs, f64)> = Vec::new();
        for i in 0..60 {
            samples.push(("cpu.total".into(), T0 + i * 1000, 10.0));
        }
        for i in 60..120 {
            samples.push(("cpu.total".into(), T0 + i * 1000, 20.0));
        }
        samples[30].2 = 95.0; // a spike inside the first bucket
        r.insert_samples("s1", &samples).await.unwrap();

        r.roll_up(Resolution::OneMinute, T0 + 200_000)
            .await
            .unwrap();

        let first = r
            .aggregate("s1", "cpu.total", Resolution::OneMinute, T0)
            .await
            .unwrap()
            .expect("first bucket");
        assert_eq!(first.samples, 60);
        assert_eq!(first.max, 95.0, "the spike must survive downsampling");
        assert_eq!(first.min, 10.0);
        assert!(first.avg < 12.0, "one spike must not dominate the mean");

        let second = r
            .aggregate("s1", "cpu.total", Resolution::OneMinute, T0 + 60_000)
            .await
            .unwrap()
            .expect("second bucket");
        assert_eq!(second.avg, 20.0);
    }

    #[tokio::test]
    async fn rolling_up_twice_is_idempotent() {
        let (r, db) = repo_with_server().await;
        let samples: Vec<_> = (0..60)
            .map(|i| ("cpu.total".to_string(), T0 + i * 1000, 42.0))
            .collect();
        r.insert_samples("s1", &samples).await.unwrap();

        r.roll_up(Resolution::OneMinute, T0 + 100_000)
            .await
            .unwrap();
        r.roll_up(Resolution::OneMinute, T0 + 100_000)
            .await
            .unwrap();

        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM metric_aggregates")
            .fetch_one(db.pool())
            .await
            .unwrap();
        assert_eq!(count.0, 1, "a second roll-up must not duplicate buckets");
    }

    #[tokio::test]
    async fn p95_is_a_value_that_was_actually_observed() {
        let (r, _db) = repo_with_server().await;
        // 100 samples, values 1..=100, all inside one hour bucket.
        let samples: Vec<_> = (1..=100)
            .map(|i| ("lat.ms".to_string(), T0 + i * 1000, i as f64))
            .collect();
        r.insert_samples("s1", &samples).await.unwrap();
        r.roll_up(Resolution::Hourly, T0 + 3_600_000).await.unwrap();

        let bucket_start = T0 - (T0 % 3_600_000);
        let agg = r
            .aggregate("s1", "lat.ms", Resolution::Hourly, bucket_start)
            .await
            .unwrap()
            .expect("hourly bucket");
        assert_eq!(agg.p95, 95.0);
        assert_eq!(agg.max, 100.0);
    }

    #[tokio::test]
    async fn prune_removes_data_past_its_retention_window() {
        let (r, db) = repo_with_server().await;
        let now = T0 + 48 * 3_600_000;
        r.insert_samples(
            "s1",
            &[
                ("cpu.total".into(), T0, 1.0),              // 48h old
                ("cpu.total".into(), now - 3_600_000, 2.0), // 1h old
            ],
        )
        .await
        .unwrap();

        let removed = r.prune(now).await.unwrap();
        assert_eq!(removed, 1);

        let left: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM metric_samples")
            .fetch_one(db.pool())
            .await
            .unwrap();
        assert_eq!(left.0, 1, "recent data must survive pruning");
    }

    #[tokio::test]
    async fn a_wide_window_reads_aggregates_not_raw_samples() {
        let (r, _db) = repo_with_server().await;
        let samples: Vec<_> = (0..120)
            .map(|i| ("cpu.total".to_string(), T0 + i * 1000, 50.0))
            .collect();
        r.insert_samples("s1", &samples).await.unwrap();
        r.roll_up(Resolution::FiveMinute, T0 + 600_000)
            .await
            .unwrap();

        // A 7-day window selects the 5-minute rollup.
        let wide = r
            .series("s1", "cpu.total", T0, T0 + 7 * 24 * 3_600_000)
            .await
            .unwrap();
        assert_eq!(wide.len(), 1, "expected one 5-minute bucket, got {wide:?}");

        // A 5-minute window still reads the raw samples.
        let narrow = r.series("s1", "cpu.total", T0, T0 + 300_000).await.unwrap();
        assert_eq!(narrow.len(), 120);
    }

    #[tokio::test]
    async fn known_metrics_reports_what_was_actually_collected() {
        let (r, _db) = repo_with_server().await;
        r.insert_samples(
            "s1",
            &[
                ("cpu.total".into(), T0, 1.0),
                ("mem.used_pct".into(), T0, 2.0),
                ("cpu.total".into(), T0 + 1000, 3.0),
            ],
        )
        .await
        .unwrap();
        assert_eq!(
            r.known_metrics("s1").await.unwrap(),
            vec!["cpu.total", "mem.used_pct"]
        );
    }
}
