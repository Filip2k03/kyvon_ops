use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_audit_logs(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(vec![])
}
