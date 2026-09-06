use std::sync::Arc;

use kyvon_core::{AuthMethod, ConnectionState, KyvonEvent};
use kyvon_ssh::{SshSession, Vault};
use kyvon_storage::ServerRepo;
use tauri::{AppHandle, Emitter, State};

use crate::hostkey::DesktopVerifier;
use crate::state::AppState;

#[tauri::command]
pub async fn connect(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    secret: Option<String>,
) -> Result<(), String> {
    let profile = ServerRepo::new(state.db.clone())
        .require(&id)
        .await
        .map_err(|e| explain_connect(&e.to_string()))?;
    {
        let sessions = state.sessions.lock().await;
        if let Some(existing) = sessions.get(&id) {
            if !existing.is_closed() {
                return Ok(());
            }
        }
    }
    emit_state(&app, &id, ConnectionState::Connecting, None);
    let one_shot = secret
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let secret = match profile.auth {
        AuthMethod::Password => {
            if one_shot.is_some() {
                one_shot
            } else {
                Vault::new()
                    .get(&id, kyvon_ssh::vault::SecretKind::Password)
                    .map_err(|e| explain_connect(&e.to_string()))?
            }
        }
        AuthMethod::PrivateKey {
            encrypted: true, ..
        } => {
            if one_shot.is_some() {
                one_shot
            } else {
                Vault::new()
                    .get(&id, kyvon_ssh::vault::SecretKind::KeyPassphrase)
                    .map_err(|e| explain_connect(&e.to_string()))?
            }
        }
        _ => None,
    };
    let verifier = Arc::new(DesktopVerifier::new(
        state.db.clone(),
        app.clone(),
        state.prompts.clone(),
        id.clone(),
    ));
    match SshSession::connect(&profile, verifier, secret).await {
        Ok(session) => {
            // The "already connected?" check above released the lock before
            // this await, so a second `connect` for the same server could have
            // raced past it and be finishing too. Re-check while holding the
            // lock and keep whichever session landed first: inserting
            // unconditionally would drop a live handle on the floor, leaving a
            // TCP connection open that nothing can reach or close.
            let mut sessions = state.sessions.lock().await;
            match sessions.get(&id) {
                Some(existing) if !existing.is_closed() => {
                    drop(sessions);
                    session.disconnect().await;
                }
                _ => sessions.insert(id.clone(), Arc::new(session)),
            }
            emit_state(&app, &id, ConnectionState::Connected, None);
            Ok(())
        }
        Err(error) => {
            let message = explain_connect(&error.to_string());
            emit_state(&app, &id, ConnectionState::Error, Some(message.clone()));
            Err(message)
        }
    }
}

#[tauri::command]
pub async fn disconnect(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    if let Some(session) = state.sessions.lock().await.remove(&id) {
        session.disconnect().await;
    }
    emit_state(&app, &id, ConnectionState::Disconnected, None);
    Ok(())
}

#[tauri::command]
pub async fn resolve_host_key(
    state: State<'_, AppState>,
    prompt_id: String,
    trust: bool,
) -> Result<(), String> {
    if state.prompts.resolve(&prompt_id, trust) {
        Ok(())
    } else {
        Err("Host-key prompt is expired or already answered.".into())
    }
}

/// Operator-facing SSH failures. Never includes secrets; names the next step.
fn explain_connect(raw: &str) -> String {
    let lower = raw.to_ascii_lowercase();
    if lower.contains("host key") && (lower.contains("changed") || lower.contains("mismatch")) {
        return format!(
            "Server identity changed. KyvonOPS stopped the connection to protect you. {raw} Confirm the new fingerprint out of band before trusting it."
        );
    }
    if lower.contains("not trusted") || lower.contains("host key") {
        return format!(
            "This host key has not been trusted on this workstation. Verify the fingerprint, then choose Trust and continue. {raw}"
        );
    }
    if lower.contains("authentication failed") || lower.contains("auth failed") {
        return format!(
            "Authentication failed. The server rejected the supplied SSH credentials. Check the username, password or private key, and the server's authentication policy. {raw}"
        );
    }
    if lower.contains("timed out") || lower.contains("timeout") {
        return format!(
            "Connection timed out. Check that the host is up, the SSH port is reachable, and no firewall is dropping the packet. {raw}"
        );
    }
    if lower.contains("connection refused") || lower.contains("refused") {
        return format!(
            "SSH connection refused. The host may be reachable, but nothing is accepting connections on this port. {raw}"
        );
    }
    if lower.contains("network is unreachable") || lower.contains("offline") {
        return format!(
            "Your device appears to be offline, or the route to the host is missing. {raw}"
        );
    }
    if lower.contains("vault") || lower.contains("no entry") || lower.contains("keychain") {
        return format!(
            "No password is stored in the OS keychain for this host. Re-enter it with Remember securely, or use an SSH agent / key file. {raw}"
        );
    }
    raw.to_string()
}

fn emit_state(app: &AppHandle, server_id: &str, state: ConnectionState, message: Option<String>) {
    let _ = app.emit(
        "kyvon-event",
        KyvonEvent::ConnectionState {
            server_id: server_id.to_string(),
            state,
            message,
        },
    );
}
