mod commands;
mod hostkey;
mod state;

use std::sync::Arc;

use kyvon_storage::Database;
use state::{AppState, SessionManager};
use tauri::Manager;
use tokio::sync::Mutex;

/// Where the local store lives.
///
/// Under the OS application-data directory, so it survives restarts and
/// upgrades. The previous implementation opened `:memory:`, which meant every
/// server the operator added vanished when the window closed.
fn database_path(app: &tauri::App) -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("kyvon.db"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let path = database_path(app)?;
            // Block here deliberately: no command may run before the store is
            // open, and failing loudly at startup is better than every later
            // call reporting a mysterious storage error.
            let db = tauri::async_runtime::block_on(Database::open(&path)).map_err(|e| {
                format!(
                    "could not open the local database at {}: {e}",
                    path.display()
                )
            })?;

            app.manage(AppState {
                db,
                sessions: Arc::new(Mutex::new(SessionManager::new())),
                collectors: Arc::new(commands::telemetry::Collectors::default()),
                prompts: Arc::new(hostkey::PendingPrompts::default()),
                terminals: Arc::new(Mutex::new(std::collections::HashMap::new())),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::servers::add_server,
            commands::servers::list_servers,
            commands::servers::delete_server,
            commands::connection::connect,
            commands::connection::disconnect,
            commands::connection::connected_servers,
            commands::connection::resolve_host_key,
            commands::terminal::open_terminal,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal,
            commands::telemetry::start_collector,
            commands::telemetry::stop_collector,
            commands::services::list_services,
            commands::services::assess_service_action,
            commands::services::start_service,
            commands::services::stop_service,
            commands::files::list_files,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::delete_file,
            commands::security::assess_risk,
            commands::audit::get_audit_logs,
            commands::notes::get_notes,
            commands::settings::get_settings,
            commands::discovery::probe_capabilities,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
