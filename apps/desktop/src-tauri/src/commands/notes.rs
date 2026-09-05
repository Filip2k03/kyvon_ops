use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn get_notes(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(vec![])
}
