use serde::{Deserialize, Serialize};

use crate::TimestampMs;

/// A host key KyvonOPS has been told to trust.
///
/// Stored locally in SQLite. A host is identified by `host:port` because the
/// same machine on a different port may legitimately present a different key.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KnownHost {
    pub host: String,
    pub port: u16,
    /// Key algorithm as advertised by the server, e.g. `ssh-ed25519`.
    pub key_type: String,
    /// `SHA256:<base64>`, the same form OpenSSH prints.
    pub fingerprint: String,
    /// Base64 of the raw public key blob, so a re-presented key can be
    /// compared byte-for-byte and not only by fingerprint.
    pub public_key: String,
    pub trusted_at: TimestampMs,
}

/// Presented to the operator when a host key is unknown or has changed.
///
/// Connection is blocked until this is answered. There is no
/// "accept automatically" setting — bypassing host key verification silently
/// is exactly the failure mode this exists to prevent (specification §7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HostKeyPrompt {
    pub server_id: String,
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub fingerprint: String,
    pub public_key: String,
    /// `None` for a first connection; `Some` when a *different* key was
    /// previously trusted, which is a materially more serious situation.
    #[serde(default)]
    pub previous_fingerprint: Option<String>,
}

impl HostKeyPrompt {
    pub fn is_change(&self) -> bool {
        self.previous_fingerprint.is_some()
    }
}
