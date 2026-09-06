use super::not_implemented;

/// The collector streams framed `/proc` and `/sys` reads back over the
/// session; `kyvon-telemetry` turns those into samples on this side. Reporting
/// a started collector that is not running would leave every metric panel
/// waiting forever with no error.
#[tauri::command]
pub async fn start_collector(id: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Starting the telemetry collector on `{id}`"),
        "an established SSH session to stream the collector over",
    ))
}

#[tauri::command]
pub async fn stop_collector(id: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Stopping the telemetry collector on `{id}`"),
        "a running collector stream",
    ))
}
