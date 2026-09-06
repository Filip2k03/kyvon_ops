use kyvon_storage::SettingsRepo;
use serde_json::Value;
use tauri::State;

use crate::state::AppState;

/// Read one setting from the local store.
///
/// Returns `null` when the key has never been set, so a caller can tell an
/// unset preference from one explicitly set to a falsy value. The previous
/// implementation returned `"{}"` for every key regardless.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>, key: String) -> Result<Value, String> {
    SettingsRepo::new(state.db.clone())
        .get::<Value>(&key)
        .await
        .map(|v| v.unwrap_or(Value::Null))
        .map_err(|e| e.to_string())
}
