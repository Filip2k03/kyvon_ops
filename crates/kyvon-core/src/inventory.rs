use serde::{Deserialize, Serialize};

use crate::capability::HostFacts;
use crate::TimestampMs;

/// How KyvonOPS authenticates to a host.
///
/// No variant carries a secret. Passwords and key passphrases live in the OS
/// keychain and are referenced indirectly by the server id; see
/// `kyvon_ssh::vault`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AuthMethod {
    /// Password held in the OS keychain under this server's vault entry.
    Password,
    /// Private key file on disk. A passphrase, if required, is in the keychain.
    PrivateKey {
        /// Absolute path to the private key.
        path: String,
        /// True when the key file is encrypted and needs a stored passphrase.
        encrypted: bool,
    },
    /// Delegate to a running ssh-agent over `SSH_AUTH_SOCK`.
    Agent,
}

impl AuthMethod {
    pub fn label(&self) -> &'static str {
        match self {
            AuthMethod::Password => "password",
            AuthMethod::PrivateKey { .. } => "publickey",
            AuthMethod::Agent => "ssh-agent",
        }
    }
}

/// A saved connection target. This is what is persisted in SQLite.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ServerProfile {
    pub id: String,
    /// Display name chosen by the operator, e.g. `production-01`.
    pub alias: String,
    pub hostname: String,
    #[serde(default = "default_port")]
    pub port: u16,
    pub username: String,
    pub auth: AuthMethod,
    /// Free-form grouping: `production`, `staging`, `client-a`.
    #[serde(default)]
    pub tags: Vec<String>,
    /// Facts learned during onboarding. `None` until the first successful probe.
    #[serde(default)]
    pub facts: Option<HostFacts>,
    #[serde(default)]
    pub created_at: TimestampMs,
    #[serde(default)]
    pub updated_at: TimestampMs,
}

fn default_port() -> u16 {
    22
}

impl ServerProfile {
    /// `user@host:port`, the form used in logs and the UI header.
    pub fn target(&self) -> String {
        format!("{}@{}:{}", self.username, self.hostname, self.port)
    }

    /// Rejects profiles that could not produce a valid SSH connection.
    ///
    /// Called in the Rust layer on every write, never only in the UI: the
    /// frontend is untrusted (specification §96).
    pub fn validate(&self) -> crate::Result<()> {
        use crate::KyvonError::Invalid;
        if self.alias.trim().is_empty() {
            return Err(Invalid("alias must not be empty".into()));
        }
        if self.hostname.trim().is_empty() {
            return Err(Invalid("hostname must not be empty".into()));
        }
        if self.hostname.contains(char::is_whitespace) {
            return Err(Invalid("hostname must not contain whitespace".into()));
        }
        if self.port == 0 {
            return Err(Invalid("port must be between 1 and 65535".into()));
        }
        if self.username.trim().is_empty() {
            return Err(Invalid("username must not be empty".into()));
        }
        // A username is interpolated into remote commands in a few places
        // (e.g. `last -w <user>`), so constrain it to what POSIX allows.
        if !self
            .username
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '$'))
        {
            return Err(Invalid(format!(
                "username `{}` contains characters that are not valid in a POSIX user name",
                self.username
            )));
        }
        if let AuthMethod::PrivateKey { path, .. } = &self.auth {
            if path.trim().is_empty() {
                return Err(Invalid("private key path must not be empty".into()));
            }
            if !std::path::Path::new(path).is_absolute() {
                return Err(Invalid(
                    "private key path must be absolute on this workstation".into(),
                ));
            }
        }
        Ok(())
    }
}

/// Lifecycle of a single SSH session, mirroring specification §7.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    VerifyingHost,
    Authenticating,
    Connected,
    Reconnecting,
    Error,
}

impl ConnectionState {
    /// Legal transitions. Enforced by the session state machine so an
    /// out-of-order event cannot, for example, report `Connected` without
    /// having authenticated.
    pub fn can_transition_to(self, next: ConnectionState) -> bool {
        use ConnectionState::*;
        match (self, next) {
            (a, b) if a == b => true,
            (Disconnected, Connecting) => true,
            (Connecting, VerifyingHost | Error | Disconnected) => true,
            (VerifyingHost, Authenticating | Error | Disconnected) => true,
            (Authenticating, Connected | Error | Disconnected) => true,
            (Connected, Reconnecting | Disconnected | Error) => true,
            (Reconnecting, Connecting | Connected | Error | Disconnected) => true,
            (Error, Connecting | Disconnected) => true,
            _ => false,
        }
    }

    pub fn is_live(self) -> bool {
        matches!(self, ConnectionState::Connected)
    }
}

/// A profile plus its live connection status, as rendered in the server list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub server_id: String,
    pub state: ConnectionState,
    /// Present when `state` is `Error`; already redacted.
    #[serde(default)]
    pub last_error: Option<String>,
    #[serde(default)]
    pub connected_at: Option<TimestampMs>,
    /// Round-trip time of the last keepalive, in milliseconds.
    #[serde(default)]
    pub latency_ms: Option<u32>,
}

impl ServerStatus {
    pub fn disconnected(server_id: impl Into<String>) -> Self {
        Self {
            server_id: server_id.into(),
            state: ConnectionState::Disconnected,
            last_error: None,
            connected_at: None,
            latency_ms: None,
        }
    }
}
