mod commands;
mod state;

use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;
use state::{AppState, SessionManager};
use kyvon_storage::db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Setup DB and State
            let db = Database::new(":memory:").expect("Failed to create db");
            let manager = Arc::new(Mutex::new(SessionManager::new()));
            app.manage(AppState {
                db: Arc::new(db),
                manager,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::servers::add_server,
            commands::servers::list_servers,
            commands::servers::delete_server,
            commands::connection::connect,
            commands::connection::disconnect,
            commands::terminal::open_terminal,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal,
            commands::telemetry::start_collector,
            commands::telemetry::stop_collector,
            commands::services::list_services,
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
