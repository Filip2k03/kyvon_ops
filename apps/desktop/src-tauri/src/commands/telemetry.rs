//! Streaming real telemetry off a host.
//!
//! The collector is piped to the remote `sh` over stdin rather than installed:
//! nothing is written to the host's filesystem, so starting telemetry leaves no
//! trace and needs no privileges beyond the login itself. Its source is
//! `COLLECTOR_SCRIPT`, short enough to read in full before agreeing to run it.
//!
//! Every number the UI shows is computed here, on this side, from those framed
//! reads — see `kyvon-telemetry`'s crate documentation for why the split is
//! that way round.

use std::collections::HashMap;
use std::sync::Arc;

use kyvon_core::KyvonEvent;
use kyvon_ssh::session::StreamItem;
use kyvon_telemetry::collector::{BlockReader, Emit, COLLECTOR_SCRIPT};
use kyvon_telemetry::{frames_from_block, TelemetryState};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

use super::{emit_event, not_implemented};
use crate::state::AppState;

/// Collector tasks by server id, so a second `start_collector` does not open a
/// second stream and `stop_collector` has something to cancel.
#[derive(Default)]
pub struct Collectors {
    tasks: Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
}

impl Collectors {
    /// Abort a running collector. Dropping the `StreamHandle` inside the task
    /// closes the SSH channel, which stops the remote `sh`.
    pub async fn stop(&self, server_id: &str) -> bool {
        match self.tasks.lock().await.remove(server_id) {
            Some(task) => {
                task.abort();
                true
            }
            None => false,
        }
    }

    async fn replace(&self, server_id: String, task: tauri::async_runtime::JoinHandle<()>) {
        if let Some(previous) = self.tasks.lock().await.insert(server_id, task) {
            previous.abort();
        }
    }

    async fn forget(&self, server_id: &str) {
        self.tasks.lock().await.remove(server_id);
    }
}

#[tauri::command]
pub async fn start_collector(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let session = state.sessions.lock().await.get(&id).ok_or_else(|| {
        not_implemented(
            &format!("Starting the telemetry collector on `{id}`"),
            "an established SSH session — connect to the server first",
        )
    })?;

    // `sh -s` reads the program from stdin, so the script never touches disk.
    let mut stream = session
        .stream("sh -s", Some(COLLECTOR_SCRIPT.as_bytes()))
        .await
        .map_err(|e| e.to_string())?;

    let collectors = state.collectors.clone();
    let server_id = id.clone();
    let task = tauri::async_runtime::spawn(async move {
        let mut reader = BlockReader::new();
        let mut telemetry = TelemetryState::new();

        while let Some(item) = stream.next().await {
            match item {
                StreamItem::Line(line) => match reader.push_line(&line) {
                    Ok(Some(Emit::Hello { .. })) => {}
                    Ok(Some(Emit::Block(block))) => {
                        for frame in frames_from_block(&block, &mut telemetry) {
                            emit_event(
                                &app,
                                KyvonEvent::Telemetry {
                                    server_id: server_id.clone(),
                                    frame,
                                },
                            );
                        }
                    }
                    Ok(None) => {}
                    // A framing error is reported, not swallowed: silence here
                    // would leave every metric panel waiting forever.
                    Err(e) => emit_stopped(&app, &server_id, Some(e.to_string())),
                },
                StreamItem::Exited(status) => {
                    // Anything the collector printed before dying is the only
                    // clue to why, so surface it rather than a bare code.
                    let detail = if reader.preamble.is_empty() {
                        format!("collector exited with status {status:?}")
                    } else {
                        format!(
                            "collector exited with status {status:?}: {}",
                            reader.preamble.join(" ")
                        )
                    };
                    emit_stopped(&app, &server_id, Some(detail));
                    break;
                }
            }
        }

        collectors.forget(&server_id).await;
    });

    state.collectors.replace(id, task).await;
    Ok(())
}

#[tauri::command]
pub async fn stop_collector(state: State<'_, AppState>, id: String) -> Result<(), String> {
    if state.collectors.stop(&id).await {
        Ok(())
    } else {
        Err(format!("No telemetry collector is running on `{id}`."))
    }
}

fn emit_stopped(app: &AppHandle, server_id: &str, message: Option<String>) {
    let _ = app.emit(
        "kyvon-collector-stopped",
        serde_json::json!({ "server_id": server_id, "message": message }),
    );
}

/// A `Collectors` handle is cheap to clone: it is an `Arc` around the map.
pub type SharedCollectors = Arc<Collectors>;
