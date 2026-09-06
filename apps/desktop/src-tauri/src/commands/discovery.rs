use super::not_implemented;

/// Probe a host for its OS, hardware and installed software (`HostFacts`).
///
/// Requires a session: the probe reads `/etc/os-release`, `/proc` and a small
/// set of command outputs over SSH. Reporting success without probing would
/// leave `ServerProfile::facts` as `None` while the UI believed it had been
/// populated.
#[tauri::command]
pub async fn probe_capabilities(id: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Probing capabilities of `{id}`"),
        "an established SSH session",
    ))
}
