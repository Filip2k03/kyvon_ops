use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn get_audit_logs(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(vec![])
}
