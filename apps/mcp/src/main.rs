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

use std::io::{self, Write};
use std::path::PathBuf;
use std::sync::Arc;

use kyvon_core::mcp::McpRole;
use kyvon_policy::mcp_server::McpProtocolHandler;
use kyvon_storage::Database;
use storage_backend::StorageBackend;
use tokio::io::{AsyncBufReadExt, BufReader};

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
///
/// `HOME` is read inside the arms that use it: binding it unconditionally left
/// it dead on Windows, which `clippy -D warnings` rejects — latent today only
/// because CI runs on Linux, while `release.yml` builds for Windows too.
fn dirs_next() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|h| h.join("Library/Application Support/com.kyvon.ops"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME")
                    .map(PathBuf::from)
                    .map(|h| h.join(".local/share"))
            })
            .map(|d| d.join("com.kyvon.ops"))
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .map(|d| d.join("com.kyvon.ops"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
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
        // An empty parent means a bare relative name like `KYVON_DB=kyvon.db`,
        // whose directory is the working directory — `Path::new("").exists()`
        // is false, so testing the parent alone refused a path sqlx opens fine.
        Some(path)
            if path.exists()
                || path
                    .parent()
                    .is_none_or(|p| p.as_os_str().is_empty() || p.exists()) =>
        {
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

    // Async stdin, not `io::stdin().lock().lines()`. The blocking form parks
    // the runtime's only thread for as long as no request arrives, which is
    // almost always — nothing spawned could make progress between messages, so
    // any timer or background task added here would silently never fire.
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    let mut stdout = io::stdout();

    while let Some(line) = lines.next_line().await? {
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
