use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<String, String> {
    Ok("{}".to_string())
}
