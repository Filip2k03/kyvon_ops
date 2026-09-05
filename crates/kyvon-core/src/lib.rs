//! Shared domain model for KyvonOPS.
//!
//! Every type that crosses a module boundary — Rust crate to Rust crate, or
//! Rust to the TypeScript frontend over Tauri IPC — is defined exactly once,
//! here. The TypeScript mirror lives in `apps/desktop/src/types/` and is kept
//! in sync by `kyvon-core`'s schema test (see `tests/schema.rs`).

pub mod capability;
pub mod error;
pub mod event;
pub mod host;
pub mod inventory;
pub mod redact;
pub mod risk;
pub mod telemetry;

pub use capability::{caps, Capabilities, CapabilityProbe, CloudHint, Confidence, HostFacts};
pub use error::{KyvonError, Result};
pub use event::KyvonEvent;
pub use host::{HostKeyPrompt, KnownHost};
pub use inventory::{AuthMethod, ConnectionState, ServerProfile, ServerStatus};
pub use redact::redact;
pub use risk::{RiskAssessment, RiskTier};
pub use telemetry::*;

/// Version of the desktop <-> agent telemetry protocol.
///
/// Bumped whenever a frame's shape changes incompatibly. The agent reports the
/// protocol version it speaks during its handshake; a mismatch is surfaced to
/// the user rather than silently tolerated.
pub const PROTOCOL_VERSION: u32 = 1;

/// Version of the local SQLite schema, owned by `kyvon-storage` migrations.
pub const SCHEMA_VERSION: u32 = 1;

/// Milliseconds since the Unix epoch.
pub type TimestampMs = i64;

/// Current wall-clock time in milliseconds since the Unix epoch.
pub fn now_ms() -> TimestampMs {
    chrono::Utc::now().timestamp_millis()
}
