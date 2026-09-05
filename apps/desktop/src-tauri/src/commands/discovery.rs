use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn probe_capabilities(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}
