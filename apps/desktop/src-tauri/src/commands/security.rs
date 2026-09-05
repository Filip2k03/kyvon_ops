use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn assess_risk(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}
