use kyvon_storage::{Note, NoteRepo};
use tauri::State;

use crate::state::AppState;

/// Operator notes for one server, from the local store.
#[tauri::command]
pub async fn get_notes(state: State<'_, AppState>, server_id: String) -> Result<Vec<Note>, String> {
    NoteRepo::new(state.db.clone())
        .list(&server_id)
        .await
        .map_err(|e| e.to_string())
}
