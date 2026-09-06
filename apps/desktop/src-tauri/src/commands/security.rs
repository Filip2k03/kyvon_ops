use kyvon_core::RiskAssessment;

/// Classify a command line before it is sent to a host (§36).
///
/// This needs no session and no network: `kyvon_security::classify` parses the
/// command POSIX-style and reports the tier of its worst segment. It is
/// therefore fully implemented, unlike the commands that require SSH.
///
/// The tier authorises nothing. It decides how much the operator is shown and
/// how deliberate their confirmation has to be, so the frontend must still
/// route the actual execution through the approval gate.
#[tauri::command]
pub async fn assess_risk(command: String) -> Result<RiskAssessment, String> {
    Ok(kyvon_security::classify(&command))
}
