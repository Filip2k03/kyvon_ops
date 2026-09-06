use super::not_implemented;

/// Opening a session needs the credential resolver: the profile says *which*
/// method to use, and `kyvon_ssh::Vault` fetches the secret from the OS
/// keychain at connect time. Until that path and the host-key prompt are
/// wired to the UI, connecting must fail rather than appear to succeed.
#[tauri::command]
pub async fn connect(id: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Connecting to server `{id}`"),
        "the credential resolver and the host-key trust prompt",
    ))
}

#[tauri::command]
pub async fn disconnect(id: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Disconnecting server `{id}`"),
        "an established SSH session",
    ))
}
