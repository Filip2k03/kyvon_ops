use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn start_collector(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn stop_collector(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}
