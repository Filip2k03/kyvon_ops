//! Interactive shells over a server's existing SSH session.
//!
//! A PTY channel is multiplexed onto the connection `connect` already opened,
//! so opening a terminal costs a channel rather than a second login.
//!
//! Two properties matter more than the plumbing:
//!
//! * **Nothing is simulated.** The screen this replaced answered `uptime` and
//!   `docker ps` with invented output and replied "Executed successfully (exit
//!   code 0)" to anything else — an operator typing `systemctl restart nginx`
//!   was told it worked. Every command below either reaches the host or
//!   returns an error saying it did not.
//! * **Closing a tab closes the channel.** Dropping the handle sends EOF and
//!   closes, so a shell is not left running on the server after the operator
//!   has stopped looking at it.

use std::sync::Arc;

use base64::Engine as _;
use kyvon_core::KyvonEvent;
use kyvon_ssh::session::TerminalItem;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;
use uuid::Uuid;

use super::{emit_event, not_implemented};
use crate::state::AppState;

/// Say which terminal is missing, not merely that something failed.
fn no_such_session(session_id: &str, action: &str) -> String {
    format!(
        "Cannot {action}: terminal session `{session_id}` is not open. \
         It may have been closed, or the remote shell may have exited. \
         Open a new terminal on the server."
    )
}

#[tauri::command]
pub async fn open_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<String, String> {
    let session = state.sessions.lock().await.get(&id).ok_or_else(|| {
        not_implemented(
            &format!("Opening a terminal on `{id}`"),
            "an established SSH session — connect to the server first",
        )
    })?;

    // A sane default rather than zero: a PTY sized 0x0 makes `less` and `vim`
    // render into nothing, and the frontend sends a real size on first fit.
    let handle = session
        .open_terminal(cols.unwrap_or(80), rows.unwrap_or(24))
        .await
        .map_err(|e| format!("Could not open a terminal on `{id}`: {e}"))?;

    // Sessions are keyed individually rather than by server: one host may
    // have several terminals open, and closing one must not disturb the rest.
    let session_id = format!("term_{}", Uuid::new_v4().simple());
    let handle = Arc::new(Mutex::new(handle));
    state
        .terminals
        .lock()
        .await
        .insert(session_id.clone(), handle.clone());

    // Pump output to the frontend on the terminal channel, which is separate
    // from the dashboard's so a chatty shell cannot starve it.
    let terminals = state.terminals.clone();
    let pump_id = session_id.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            // The lock is taken per read and released immediately, so a
            // keystroke arriving mid-read is not blocked behind it.
            let item = handle.lock().await.next().await;

            match item {
                Some(TerminalItem::Bytes(bytes)) => emit_event(
                    &app,
                    KyvonEvent::TerminalOutput {
                        session_id: pump_id.clone(),
                        // Terminal output is not guaranteed to be valid UTF-8:
                        // a partial multi-byte sequence at a read boundary, or
                        // raw bytes from a binary, would be mangled by a
                        // lossy conversion before the frontend could see them.
                        data_b64: base64::engine::general_purpose::STANDARD.encode(&bytes),
                    },
                ),
                Some(TerminalItem::Exited(exit_status)) => {
                    emit_event(
                        &app,
                        KyvonEvent::TerminalClosed {
                            session_id: pump_id.clone(),
                            exit_status,
                        },
                    );
                    break;
                }
                None => {
                    // Channel closed without an exit status — the transport
                    // went away. Still report closure, or the tab hangs.
                    emit_event(
                        &app,
                        KyvonEvent::TerminalClosed {
                            session_id: pump_id.clone(),
                            exit_status: None,
                        },
                    );
                    break;
                }
            }
        }
        terminals.lock().await.remove(&pump_id);
    });

    Ok(session_id)
}

#[tauri::command]
pub async fn write_terminal(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let handle = state
        .terminals
        .lock()
        .await
        .get(&session_id)
        .cloned()
        .ok_or_else(|| no_such_session(&session_id, "send input"))?;

    let handle = handle.lock().await;
    handle
        .write(data.as_bytes())
        .await
        .map_err(|e| format!("Could not send input to `{session_id}`: {e}"))
}

#[tauri::command]
pub async fn resize_terminal(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let handle = state
        .terminals
        .lock()
        .await
        .get(&session_id)
        .cloned()
        .ok_or_else(|| no_such_session(&session_id, "resize the terminal"))?;

    let handle = handle.lock().await;
    handle
        .resize(cols, rows)
        .await
        .map_err(|e| format!("Could not resize `{session_id}`: {e}"))
}

#[tauri::command]
pub async fn close_terminal(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    // Absent is success: closing a tab twice, or closing one whose shell has
    // already exited, is not an error the operator can act on.
    let removed = state.terminals.lock().await.remove(&session_id);
    if let Some(handle) = removed {
        handle.lock().await.close().await;
    }
    Ok(())
}
