use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn connect(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn disconnect(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}
