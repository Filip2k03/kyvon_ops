use kyvon_core::{HostFacts, KyvonEvent};
use kyvon_ssh::discovery;
use kyvon_storage::ServerRepo;
use tauri::{AppHandle, State};

use super::{emit_event, not_implemented};
use crate::state::AppState;

/// Learn what a host is and what it can do (`HostFacts`).
///
/// The probe is one script over one channel — a single round trip rather than
/// twenty `command -v` calls — and every check in it is a read: nothing is
/// installed and nothing is configured.
///
/// Facts are persisted so the inventory can show an OS and a core count
/// without a live session, and each individual check is emitted as it is
/// interpreted so onboarding can show progress. `ServerProfile::facts` stays
/// `None` until this succeeds, which is why the UI says "not probed" rather
/// than guessing a distribution from the hostname.
#[tauri::command]
pub async fn probe_capabilities(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<HostFacts, String> {
    let session = state.sessions.lock().await.get(&id).ok_or_else(|| {
        not_implemented(
            &format!("Probing capabilities of `{id}`"),
            "an established SSH session — connect to the server first",
        )
    })?;

    let facts = discovery::probe(&session)
        .await
        .map_err(|e| format!("Probe of `{id}` failed: {e}"))?;

    // Persist before reporting: a caller that receives facts should be able to
    // reload and still see them.
    ServerRepo::new(state.db.clone())
        .set_facts(&id, &facts)
        .await
        .map_err(|e| format!("Probed `{id}` but could not save the result: {e}"))?;

    for probe in discovery::to_probe_log(&facts) {
        emit_event(
            &app,
            KyvonEvent::Probe {
                server_id: id.clone(),
                probe,
            },
        );
    }

    Ok(facts)
}
