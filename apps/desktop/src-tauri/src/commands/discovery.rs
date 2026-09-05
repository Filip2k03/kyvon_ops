use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn probe_capabilities(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}
