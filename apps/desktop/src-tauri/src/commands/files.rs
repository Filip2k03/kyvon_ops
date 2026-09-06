use super::not_implemented;

/// SFTP over the server's session. `read_file` previously returned an empty
/// string, which an editor cannot tell from a genuinely empty file — saving
/// over it would have destroyed the contents.
#[tauri::command]
pub async fn list_files(id: String, path: String) -> Result<Vec<String>, String> {
    Err(not_implemented(
        &format!("Listing `{path}` on `{id}`"),
        "an established SSH session with an SFTP subsystem",
    ))
}

#[tauri::command]
pub async fn read_file(id: String, path: String) -> Result<String, String> {
    Err(not_implemented(
        &format!("Reading `{path}` on `{id}`"),
        "an established SSH session with an SFTP subsystem",
    ))
}

#[tauri::command]
pub async fn write_file(id: String, path: String, content: String) -> Result<(), String> {
    let _ = content;
    Err(not_implemented(
        &format!("Writing `{path}` on `{id}`"),
        "an established SSH session and the approval gate",
    ))
}

#[tauri::command]
pub async fn delete_file(id: String, path: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Deleting `{path}` on `{id}`"),
        "an established SSH session and the approval gate",
    ))
}
