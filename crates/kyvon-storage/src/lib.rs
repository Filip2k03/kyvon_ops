//! The local store: inventory, telemetry history, audit and notes.
//!
//! KyvonOPS is local-first (specification §90), so this SQLite file is the
//! only database in the product. It never holds a secret — see the header
//! comment in `database/migrations/0001_initial.sql`.
//!
//! Everything is addressed through small repositories rather than a shared
//! connection handed around, so the SQL for a concept lives in one place and
//! can be tested against a real in-memory database.

pub mod audit;
pub mod db;
pub mod hosts;
pub mod metrics;
pub mod notes;
pub mod servers;
pub mod settings;
pub mod snapshots;

pub use audit::{AuditEvent, AuditRepo, Outcome};
pub use db::Database;
pub use hosts::{HostKeyStatus, KnownHostRepo};
pub use metrics::MetricRepo;
pub use notes::{Note, NoteRepo};
pub use servers::ServerRepo;
pub use settings::SettingsRepo;
pub use snapshots::{Snapshot, SnapshotRepo};
