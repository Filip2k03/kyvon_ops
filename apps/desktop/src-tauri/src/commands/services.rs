use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_services(state: State<'_, AppState>, id: String) -> Result<Vec<String>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn start_service(
    state: State<'_, AppState>,
    id: String,
    service: String,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn stop_service(
    state: State<'_, AppState>,
    id: String,
    service: String,
) -> Result<(), String> {
    Ok(())
}
