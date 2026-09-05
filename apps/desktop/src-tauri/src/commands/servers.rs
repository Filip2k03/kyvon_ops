//! Inventory commands, backed by the real `ServerRepo`.
//!
//! These persist connection *shape* only. A password or key passphrase never
//! reaches this module — it goes to the OS keychain through `kyvon_ssh::Vault`
//! at connect time, so the SQLite file stays an inventory rather than a set of
//! credentials (specification §90, and the header of `0001_initial.sql`).

use kyvon_core::inventory::{AuthMethod, ServerProfile};
use kyvon_storage::ServerRepo;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;

/// What the UI sends when adding a host.
///
/// Deliberately not `ServerProfile`: the frontend does not get to choose an
/// id, a creation timestamp, or the probed facts. Those are assigned here so
/// a malformed or hostile payload cannot overwrite an existing row by id.
#[derive(Debug, serde::Deserialize)]
pub struct NewServer {
    pub alias: String,
    pub hostname: String,
    #[serde(default = "default_port")]
    pub port: u16,
    pub username: String,
    #[serde(default)]
    pub auth: Option<AuthMethod>,
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_port() -> u16 {
    22
}

/// Map a domain error to a message the UI can act on (§118).
fn as_message(err: kyvon_core::KyvonError) -> String {
    err.to_string()
}

#[tauri::command]
pub async fn add_server(state: State<'_, AppState>, server: NewServer) -> Result<String, String> {
    if server.alias.trim().is_empty() {
        return Err("A server needs an alias to identify it in the inventory.".into());
    }
    if server.hostname.trim().is_empty() {
        return Err("A server needs a hostname or IP address to connect to.".into());
    }

    let now = kyvon_core::now_ms();
    let profile = ServerProfile {
        id: format!("srv_{}", Uuid::new_v4().simple()),
        alias: server.alias.trim().to_string(),
        hostname: server.hostname.trim().to_string(),
        port: server.port,
        username: server.username.trim().to_string(),
        // Default to the agent: it is the only method that needs no secret
        // stored anywhere, so it is the safe thing to assume.
        auth: server.auth.unwrap_or(AuthMethod::Agent),
        tags: server.tags,
        facts: None,
        created_at: now,
        updated_at: now,
    };

    let id = profile.id.clone();
    ServerRepo::new(state.db.clone())
        .upsert(&profile)
        .await
        .map_err(as_message)?;
    Ok(id)
}

#[tauri::command]
pub async fn list_servers(state: State<'_, AppState>) -> Result<Vec<ServerProfile>, String> {
    ServerRepo::new(state.db.clone())
        .list()
        .await
        .map_err(as_message)
}

#[tauri::command]
pub async fn delete_server(state: State<'_, AppState>, id: String) -> Result<(), String> {
    // Drop any live session first: leaving a connection open to a host that
    // is no longer in the inventory would leave it unreachable from the UI
    // but still holding a socket.
    if let Some(session) = state.sessions.lock().await.remove(&id) {
        drop(session);
    }
    ServerRepo::new(state.db.clone())
        .delete(&id)
        .await
        .map_err(as_message)
}
