use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn assess_risk(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}
