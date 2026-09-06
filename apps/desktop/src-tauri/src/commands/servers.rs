//! Inventory commands, backed by the real `ServerRepo`.
//!
//! These persist connection *shape* only. A password or key passphrase never
//! reaches SQLite — it goes to the OS keychain through `kyvon_ssh::Vault`
//! (specification §90, and the header of `0001_initial.sql`).

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
/// Secrets are a separate command argument so they cannot be serialised into
/// the inventory row even by mistake.
#[derive(serde::Deserialize)]
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

fn as_message(err: kyvon_core::KyvonError) -> String {
    err.to_string()
}

/// Persist a connection profile. `secret` is written to the OS keychain and
/// is never stored in SQLite. The command never returns it.
#[tauri::command]
pub async fn add_server(
    state: State<'_, AppState>,
    server: NewServer,
    secret: Option<String>,
) -> Result<String, String> {
    if server.port == 0 {
        return Err("SSH port must be between 1 and 65535.".into());
    }

    let now = kyvon_core::now_ms();
    let profile = ServerProfile {
        id: format!("srv_{}", Uuid::new_v4().simple()),
        alias: server.alias.trim().to_string(),
        hostname: server.hostname.trim().to_string(),
        port: server.port,
        username: server.username.trim().to_string(),
        auth: server.auth.unwrap_or(AuthMethod::Agent),
        tags: server.tags,
        facts: None,
        created_at: now,
        updated_at: now,
    };
    profile.validate().map_err(as_message)?;

    match &profile.auth {
        AuthMethod::Password => {
            let Some(value) = secret.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
                return Err(
                    "Password authentication needs the password once so it can be stored in the OS keychain. KyvonOPS never writes it to the inventory database."
                        .into(),
                );
            };
            kyvon_ssh::Vault::new()
                .store(&profile.id, kyvon_ssh::vault::SecretKind::Password, value)
                .map_err(as_message)?;
        }
        AuthMethod::PrivateKey {
            encrypted: true, ..
        } => {
            if let Some(value) = secret.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                kyvon_ssh::Vault::new()
                    .store(
                        &profile.id,
                        kyvon_ssh::vault::SecretKind::KeyPassphrase,
                        value,
                    )
                    .map_err(as_message)?;
            }
        }
        _ => {
            if secret.as_deref().is_some_and(|s| !s.is_empty()) {
                return Err(
                    "This authentication method does not accept a password. Use the SSH agent or a key file."
                        .into(),
                );
            }
        }
    }

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
    if let Some(session) = state.sessions.lock().await.remove(&id) {
        drop(session);
    }
    if let Err(e) = kyvon_ssh::Vault::new().delete_all(&id) {
        tracing::error!("could not remove keychain secrets for `{id}`: {e}");
    }
    ServerRepo::new(state.db.clone())
        .delete(&id)
        .await
        .map_err(as_message)
}
