use kyvon_storage::{AuditEvent, AuditRepo};
use tauri::State;

use crate::state::AppState;

/// How many events one page of the audit view holds. Bounded so a long-lived
/// installation cannot pull its whole history into the renderer at once (§75).
const DEFAULT_LIMIT: u32 = 200;

/// Read the local audit trail (§61).
///
/// Local SQLite, so this works without a session. Returns typed events rather
/// than the previous `Vec<String>`, which could not carry actor, risk tier or
/// verification outcome.
#[tauri::command]
pub async fn get_audit_logs(
    state: State<'_, AppState>,
    server_id: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<AuditEvent>, String> {
    AuditRepo::new(state.db.clone())
        .recent(server_id.as_deref(), limit.unwrap_or(DEFAULT_LIMIT))
        .await
        .map_err(|e| e.to_string())
}
