//! Process-wide state for the desktop backend.
//!
//! Two things outlive any single command: the local SQLite store, and the set
//! of live SSH sessions. Both are shared across Tauri command invocations,
//! which run concurrently on the async runtime.

use std::collections::HashMap;
use std::sync::Arc;

use kyvon_ssh::SshSession;
use kyvon_storage::Database;
use tokio::sync::Mutex;

use crate::hostkey::PendingPrompts;

/// Live SSH sessions, keyed by server id.
///
/// One session per server, not one per feature: telemetry, terminals, SFTP
/// and one-off exec all multiplex over the same authenticated connection
/// (see `kyvon-ssh`'s crate docs), so this map is what keeps eight servers to
/// eight TCP connections.
#[derive(Default)]
pub struct SessionManager {
    sessions: HashMap<String, Arc<SshSession>>,
}

// `remove` is used by `delete_server`; the rest of this surface is what
// `connect` will use once the credential resolver and host-key prompt are
// wired. Kept rather than deleted so the intended contract stays visible, and
// marked explicitly so it does not read as an oversight.
#[allow(
    dead_code,
    reason = "session lifecycle API awaiting the connect command"
)]
impl SessionManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, server_id: &str) -> Option<Arc<SshSession>> {
        self.sessions.get(server_id).cloned()
    }

    pub fn insert(&mut self, server_id: String, session: Arc<SshSession>) {
        self.sessions.insert(server_id, session);
    }

    /// Drop a session. Returns it so the caller can close it explicitly
    /// rather than relying on the connection dying when the last `Arc` goes.
    pub fn remove(&mut self, server_id: &str) -> Option<Arc<SshSession>> {
        self.sessions.remove(server_id)
    }

    pub fn is_connected(&self, server_id: &str) -> bool {
        self.sessions.contains_key(server_id)
    }
}

pub struct AppState {
    pub db: Database,
    pub sessions: Arc<Mutex<SessionManager>>,
    pub prompts: Arc<PendingPrompts>,
    pub collectors: crate::commands::telemetry::SharedCollectors,
}
