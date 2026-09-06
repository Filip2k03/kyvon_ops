//! The KyvonOPS MCP gateway, spoken over stdio.
//!
//! One line in, one line out. Notifications produce no response, as JSON-RPC
//! requires, so a client sending `notifications/initialized` does not hang
//! waiting for a reply that should never come.
//!
//! The gateway starts as an `Observer`: no trusted identity has been
//! established at this point, and least privilege is the only safe default for
//! a process anything on the machine can spawn. Raising that is a deliberate
//! act of configuration, not something a client can ask for.

mod storage_backend;

use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::sync::Arc;

use kyvon_core::mcp::McpRole;
use kyvon_policy::mcp_server::McpProtocolHandler;
use kyvon_storage::Database;
use storage_backend::StorageBackend;

/// The store the desktop writes to.
///
/// `KYVON_DB` overrides it, which is what the tests and a second workspace
/// use. Without a database the gateway still speaks the protocol and reports
/// that no backend is attached — it does not invent answers.
fn database_path() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("KYVON_DB") {
        return Some(PathBuf::from(explicit));
    }
    dirs_next()?.join("kyvon.db").into()
}

/// The platform application-data directory Tauri writes under.
fn dirs_next() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").map(PathBuf::from);
    #[cfg(target_os = "macos")]
    return home.map(|h| h.join("Library/Application Support/com.kyvon.ops"));
    #[cfg(target_os = "linux")]
    return std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| home.map(|h| h.join(".local/share")))
        .map(|d| d.join("com.kyvon.ops"));
    #[cfg(target_os = "windows")]
    return std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|d| d.join("com.kyvon.ops"));
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    return home;
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    eprintln!("[KYVONOPS-MCP] Listening on stdio for Codex Astra / Claude Opus / Agy Gemini 3.8.");

    let mut handler = McpProtocolHandler::new(McpRole::Observer);

    // Open when the file exists, or when its directory does — `sqlx` creates
    // and migrates the store, so a gateway started before the desktop reports
    // an empty inventory rather than no backend at all. Both are honest, but
    // "no servers yet" is the more useful truth.
    match database_path() {
        Some(path) if path.exists() || path.parent().is_some_and(|p| p.exists()) => {
            match Database::open(&path).await {
                Ok(db) => {
                    eprintln!("[KYVONOPS-MCP] Reading inventory from {}", path.display());
                    handler = handler.with_backend(Arc::new(StorageBackend::new(db)));
                }
                // A store we cannot open is reported, not worked around: every
                // tool will say no backend is attached, which is true.
                Err(e) => eprintln!(
                    "[KYVONOPS-MCP] Could not open {}: {e}. Tools will report that no backend is attached.",
                    path.display()
                ),
            }
        }
        Some(path) => eprintln!(
            "[KYVONOPS-MCP] No database at {} and its directory does not exist.",
            path.display()
        ),
        None => eprintln!("[KYVONOPS-MCP] Could not determine the application data directory."),
    }

    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line_result in stdin.lock().lines() {
        let line = line_result?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Some(response) = handler.handle_message(trimmed).await else {
            continue;
        };

        writeln!(stdout, "{}", serde_json::to_string(&response)?)?;
        stdout.flush()?;
    }

    eprintln!("[KYVONOPS-MCP] Server shutting down.");
    Ok(())
}
