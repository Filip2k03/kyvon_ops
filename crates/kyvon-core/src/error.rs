use serde::{Deserialize, Serialize};

pub type Result<T> = std::result::Result<T, KyvonError>;

/// The single error type crossing KyvonOPS module and IPC boundaries.
///
/// Errors are serialisable so the frontend can render a specific, actionable
/// message (see §73 of the specification) instead of an opaque code. Every
/// variant carries enough context to explain *what* failed and *why*, and
/// `remedies()` supplies the "possible causes" list the UI shows.
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
#[serde(tag = "kind", content = "detail", rename_all = "snake_case")]
pub enum KyvonError {
    #[error("no server is registered with id {0}")]
    UnknownServer(String),

    #[error("server {0} is not connected")]
    NotConnected(String),

    #[error("connection to {host} timed out after {timeout_secs}s")]
    ConnectTimeout { host: String, timeout_secs: u64 },

    #[error("could not reach {host}:{port} — {reason}")]
    Unreachable {
        host: String,
        port: u16,
        reason: String,
    },

    #[error("authentication failed for {username}@{host} using {method}")]
    AuthFailed {
        host: String,
        username: String,
        method: String,
    },

    #[error("host key for {host} is not trusted")]
    HostKeyUntrusted { host: String, fingerprint: String },

    #[error("host key for {host} CHANGED — this may indicate interception")]
    HostKeyMismatch {
        host: String,
        expected: String,
        presented: String,
    },

    #[error("ssh transport error: {0}")]
    Transport(String),

    #[error("sftp error: {0}")]
    Sftp(String),

    #[error("remote command exited with status {status}: {stderr}")]
    RemoteCommand { status: u32, stderr: String },

    #[error("the remote host does not provide {0}")]
    Unsupported(String),

    #[error("permission denied: {0}")]
    PermissionDenied(String),

    #[error("operation refused by the safety gate: {0}")]
    Refused(String),

    #[error("invalid input: {0}")]
    Invalid(String),

    #[error("could not parse {what}: {reason}")]
    Parse { what: String, reason: String },

    #[error("storage error: {0}")]
    Storage(String),

    #[error("secret vault error: {0}")]
    Vault(String),

    #[error("io error: {0}")]
    Io(String),
}

impl KyvonError {
    /// Human-readable causes the user can act on, matching specification §73.
    pub fn remedies(&self) -> Vec<&'static str> {
        match self {
            KyvonError::ConnectTimeout { .. } | KyvonError::Unreachable { .. } => vec![
                "the hostname or IP address is incorrect",
                "the SSH port is not the one configured",
                "a firewall or security group is blocking the connection",
                "the server is powered off or still booting",
            ],
            KyvonError::AuthFailed { .. } => vec![
                "the username is incorrect for this host",
                "the private key is not authorised on the server",
                "the key requires a passphrase that was not supplied",
                "the server rejects this authentication method",
            ],
            KyvonError::HostKeyMismatch { .. } => vec![
                "the server was rebuilt and regenerated its host key",
                "the address now resolves to a different machine",
                "the connection is being intercepted",
            ],
            KyvonError::PermissionDenied(_) => vec![
                "the login user lacks permission for this path or unit",
                "the action requires elevated privileges",
            ],
            KyvonError::Unsupported(_) => vec![
                "the remote system does not ship this component",
                "the component is present but not on the login PATH",
            ],
            _ => vec![],
        }
    }

    /// Whether retrying the same operation unchanged could plausibly succeed.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            KyvonError::ConnectTimeout { .. }
                | KyvonError::Unreachable { .. }
                | KyvonError::Transport(_)
                | KyvonError::NotConnected(_)
        )
    }
}

impl From<std::io::Error> for KyvonError {
    fn from(e: std::io::Error) -> Self {
        KyvonError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for KyvonError {
    fn from(e: serde_json::Error) -> Self {
        KyvonError::Parse {
            what: "json".into(),
            reason: e.to_string(),
        }
    }
}
