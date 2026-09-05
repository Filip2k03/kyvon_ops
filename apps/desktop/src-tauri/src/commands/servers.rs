use tauri::State;
use crate::state::AppState;
use kyvon_core::inventory::ServerProfile;

#[tauri::command]
pub async fn add_server(state: State<'_, AppState>, server: ServerProfile) -> Result<(), String> {
    // Dummy impl
    Ok(())
}

#[tauri::command]
pub async fn list_servers(state: State<'_, AppState>) -> Result<Vec<ServerProfile>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn delete_server(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}
