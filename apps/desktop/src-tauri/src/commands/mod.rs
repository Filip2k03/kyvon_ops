pub mod audit;
pub mod connection;
pub mod discovery;
pub mod files;
pub mod notes;
pub mod security;
pub mod servers;
pub mod services;
pub mod settings;
pub mod telemetry;
pub mod terminal;

/// The error an unimplemented command returns.
///
/// These commands previously returned `Ok(())` or `Ok(vec![])`, which is a
/// lie the UI cannot detect: `stop_service` reported that a service had been
/// stopped, `delete_file` that a file had been deleted, and `read_file`
/// returned an empty string for a file it never opened. A caller has no way
/// to distinguish that from a real success.
///
/// Refusing explicitly is what lets the frontend say "unavailable" instead of
/// "done" (PROMPTS.md §108), and the message names the missing piece so the
/// error is actionable rather than mysterious (§118).
pub fn not_implemented(operation: &str, needs: &str) -> String {
    format!(
        "{operation} is not implemented in this build. \
         It requires {needs}, which is not wired to the desktop backend yet. \
         No change was made on the remote host."
    )
}

/// Emit a domain event on the channel it declares.
///
/// `KyvonEvent::channel()` routes telemetry and terminal traffic away from the
/// dashboard's listener, so a busy terminal cannot starve it and the frontend
/// can unsubscribe from one without the other. Emitting everything on a single
/// hardcoded channel would quietly undo that.
pub fn emit_event(app: &tauri::AppHandle, event: kyvon_core::KyvonEvent) {
    use tauri::Emitter;
    let _ = app.emit(event.channel(), &event);
}
