use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn open_terminal(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn write_terminal(state: State<'_, AppState>, id: String, data: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn resize_terminal(state: State<'_, AppState>, id: String, rows: u16, cols: u16) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn close_terminal(state: State<'_, AppState>, id: String) -> Result<(), String> {
    Ok(())
}
