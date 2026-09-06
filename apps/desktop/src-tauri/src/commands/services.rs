use super::not_implemented;

/// systemd unit control. `start_service` and `stop_service` are writes and
/// must additionally pass risk classification and the approval gate before
/// they reach a host (§49), so returning `Ok(())` here was doubly wrong: it
/// claimed an effect *and* bypassed the gate.
#[tauri::command]
pub async fn list_services(id: String) -> Result<Vec<String>, String> {
    Err(not_implemented(
        &format!("Listing services on `{id}`"),
        "an established SSH session",
    ))
}

#[tauri::command]
pub async fn start_service(id: String, service: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Starting `{service}` on `{id}`"),
        "an established SSH session and the approval gate",
    ))
}

#[tauri::command]
pub async fn stop_service(id: String, service: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Stopping `{service}` on `{id}`"),
        "an established SSH session and the approval gate",
    ))
}
