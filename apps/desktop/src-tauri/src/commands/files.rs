use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn list_files(state: State<'_, AppState>, id: String, path: String) -> Result<Vec<String>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn read_file(state: State<'_, AppState>, id: String, path: String) -> Result<String, String> {
    Ok("".to_string())
}

#[tauri::command]
pub async fn write_file(state: State<'_, AppState>, id: String, path: String, content: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn delete_file(state: State<'_, AppState>, id: String, path: String) -> Result<(), String> {
    Ok(())
}
