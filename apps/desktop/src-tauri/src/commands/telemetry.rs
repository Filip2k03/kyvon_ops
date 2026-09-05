use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn start_collector(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn stop_collector(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}
