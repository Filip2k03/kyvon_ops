use serde::{Deserialize, Serialize};

use crate::{
    capability::CapabilityProbe, host::HostKeyPrompt, inventory::ConnectionState, telemetry::Frame,
    KyvonError, TimestampMs,
};

/// Everything the Rust core pushes to the frontend, and everything the internal
/// bus carries between subsystems (specification §54).
///
/// A single enum keeps the IPC surface enumerable: the frontend listens on one
/// Tauri event channel and matches exhaustively, so a new event type cannot be
/// added on the Rust side without the TypeScript union failing to compile.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum KyvonEvent {
    /// The SSH session state machine advanced.
    ConnectionState {
        server_id: String,
        state: ConnectionState,
        #[serde(default)]
        message: Option<String>,
    },

    /// A host key needs an explicit trust decision before the connection can
    /// continue. The connection attempt is parked until answered.
    HostKeyPrompt { prompt: HostKeyPrompt },

    /// One onboarding capability check completed.
    Probe {
        server_id: String,
        probe: CapabilityProbe,
    },

    /// A telemetry frame arrived from the agent.
    Telemetry { server_id: String, frame: Frame },

    /// Bytes from an interactive terminal channel, base64-encoded because
    /// terminal output is not guaranteed to be valid UTF-8.
    TerminalOutput {
        session_id: String,
        #[serde(rename = "dataB64")]
        data_b64: String,
    },

    /// The remote shell exited; the terminal tab should show the status.
    TerminalClosed {
        session_id: String,
        #[serde(default)]
        exit_status: Option<u32>,
    },

    /// A line from a followed log stream.
    LogLine {
        stream_id: String,
        line: String,
        ts: TimestampMs,
    },

    /// A followed log stream ended, normally or otherwise.
    LogClosed {
        stream_id: String,
        #[serde(default)]
        error: Option<KyvonError>,
    },

    /// Something went wrong outside the scope of a single command — a
    /// background task, a reconnect, a collector.
    Fault {
        server_id: String,
        source: String,
        error: KyvonError,
    },

    /// An operation was recorded in the audit ledger.
    Audited { id: String, summary: String },
}

impl KyvonEvent {
    /// Tauri event channel this is emitted on. Telemetry and terminal traffic
    /// get dedicated channels so a busy terminal cannot starve the dashboard's
    /// listener, and so the frontend can unsubscribe from one without the
    /// other.
    pub fn channel(&self) -> &'static str {
        match self {
            KyvonEvent::Telemetry { .. } => "kyvon://telemetry",
            KyvonEvent::TerminalOutput { .. } | KyvonEvent::TerminalClosed { .. } => {
                "kyvon://terminal"
            }
            KyvonEvent::LogLine { .. } | KyvonEvent::LogClosed { .. } => "kyvon://logs",
            _ => "kyvon://core",
        }
    }
}
