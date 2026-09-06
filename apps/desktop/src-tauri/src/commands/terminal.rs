use super::not_implemented;

/// A PTY channel over the server's multiplexed session. Every one of these
/// refuses until `connect` can produce that session — a terminal that accepts
/// keystrokes without a channel would silently discard them.
#[tauri::command]
pub async fn open_terminal(id: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Opening a terminal on `{id}`"),
        "an established SSH session to allocate a PTY channel on",
    ))
}

#[tauri::command]
pub async fn write_terminal(id: String, data: String) -> Result<(), String> {
    let _ = data;
    Err(not_implemented(
        &format!("Writing to the terminal on `{id}`"),
        "an open PTY channel",
    ))
}

#[tauri::command]
pub async fn resize_terminal(id: String, rows: u16, cols: u16) -> Result<(), String> {
    let _ = (rows, cols);
    Err(not_implemented(
        &format!("Resizing the terminal on `{id}`"),
        "an open PTY channel",
    ))
}

#[tauri::command]
pub async fn close_terminal(id: String) -> Result<(), String> {
    Err(not_implemented(
        &format!("Closing the terminal on `{id}`"),
        "an open PTY channel",
    ))
}
