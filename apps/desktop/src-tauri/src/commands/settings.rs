use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<String, String> {
    Ok("{}".to_string())
}
