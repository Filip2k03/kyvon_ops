use std::sync::Arc;

use kyvon_core::{AuthMethod, ConnectionState, KyvonEvent};
use kyvon_ssh::{SshSession, Vault};
use kyvon_storage::ServerRepo;
use tauri::{AppHandle, Emitter, State};

use crate::hostkey::DesktopVerifier;
use crate::state::AppState;

#[tauri::command]
pub async fn connect(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    let profile = ServerRepo::new(state.db.clone())
        .require(&id)
        .await
        .map_err(|e| e.to_string())?;
    {
        let sessions = state.sessions.lock().await;
        if let Some(existing) = sessions.get(&id) {
            if !existing.is_closed() {
                return Ok(());
            }
        }
    }
    emit_state(&app, &id, ConnectionState::Connecting, None);
    let secret = match profile.auth {
        AuthMethod::Password => Vault::new()
            .get(&id, kyvon_ssh::vault::SecretKind::Password)
            .map_err(|e| e.to_string())?,
        AuthMethod::PrivateKey {
            encrypted: true, ..
        } => Vault::new()
            .get(&id, kyvon_ssh::vault::SecretKind::KeyPassphrase)
            .map_err(|e| e.to_string())?,
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
            let message = error.to_string();
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
