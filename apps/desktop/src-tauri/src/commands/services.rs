//! systemd unit inspection and control.
//!
//! Listing is a read and runs directly. Starting and stopping are writes, and
//! they follow the pipeline the whole architecture exists to enforce
//! (specification §49):
//!
//! ```text
//! intent -> validate -> resolve target -> classify risk -> execute -> verify -> audit
//! ```
//!
//! The classification step is not decoration. `stop_service` on a production
//! host is how an operator takes a site down by accident, so the command is
//! built from a fixed program and a quoted unit name — never assembled by
//! concatenation — and the caller is told what tier the operation carries.

use kyvon_core::{RiskAssessment, ServiceInfo};
use kyvon_security::Cmd;
use kyvon_ssh::SshSession;
use kyvon_storage::{AuditEvent, AuditRepo, Outcome};
use tauri::State;

use super::not_implemented;
use crate::state::AppState;

/// Ask for a session, or explain that there is not one.
async fn session_for(
    state: &State<'_, AppState>,
    id: &str,
    what: &str,
) -> Result<std::sync::Arc<SshSession>, String> {
    state.sessions.lock().await.get(id).ok_or_else(|| {
        not_implemented(
            what,
            "an established SSH session — connect to the server first",
        )
    })
}

#[tauri::command]
pub async fn list_services(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<ServiceInfo>, String> {
    let session = session_for(&state, &id, &format!("Listing services on `{id}`")).await?;

    let units = session
        .exec(&Cmd::new("systemctl").map_err(|e| e.to_string())?.args([
            "list-units",
            "--type=service",
            "--all",
            "--plain",
            "--no-legend",
            "--no-pager",
        ]))
        .await
        .map_err(|e| format!("Could not list services on `{id}`: {e}"))?;

    // A host without systemd is a fact about the host, not a failure to hide.
    if !units.success() {
        return Err(format!(
            "`systemctl` failed on `{id}` (status {}). {} \
             This host may not use systemd, or the login may lack permission to query it.",
            units.exit_status.unwrap_or(255),
            kyvon_core::redact(units.stderr.trim()),
        ));
    }

    let mut services = kyvon_telemetry::commands::parse_systemctl_units(&units.stdout)
        .map_err(|e| format!("Could not read the unit list from `{id}`: {e}"))?;

    // Boot enablement is a second query, and a useful list without it beats no
    // list at all — so a failure here leaves `enabled` as None rather than
    // failing the whole call.
    if let Ok(files) = session
        .exec(&Cmd::new("systemctl").map_err(|e| e.to_string())?.args([
            "list-unit-files",
            "--type=service",
            "--plain",
            "--no-legend",
            "--no-pager",
        ]))
        .await
    {
        if files.success() {
            kyvon_telemetry::commands::merge_unit_enablement(&mut services, &files.stdout);
        }
    }

    Ok(services)
}

/// What `start_service` / `stop_service` would do, without doing it.
///
/// The UI calls this to show the operator the exact command, its risk tier and
/// its expected impact before asking for confirmation. Returning the rendered
/// command matters: an operator confirming a stop should see the literal text
/// that will run, not a description of it.
#[tauri::command]
pub async fn assess_service_action(
    action: String,
    service: String,
) -> Result<RiskAssessment, String> {
    Ok(kyvon_security::classify(
        &unit_command(&action, &service)?.render(),
    ))
}

#[tauri::command]
pub async fn start_service(
    state: State<'_, AppState>,
    id: String,
    service: String,
) -> Result<ServiceInfo, String> {
    control(state, id, service, "start").await
}

#[tauri::command]
pub async fn stop_service(
    state: State<'_, AppState>,
    id: String,
    service: String,
) -> Result<ServiceInfo, String> {
    control(state, id, service, "stop").await
}

/// Build the unit command.
///
/// `Cmd` quotes the unit name as a single word, so a name containing `;` or a
/// substitution cannot become a second command. The verb is checked against a
/// fixed list rather than interpolated, so this cannot be turned into an
/// arbitrary `systemctl` invocation by a caller.
fn unit_command(action: &str, service: &str) -> Result<Cmd, String> {
    if !matches!(action, "start" | "stop" | "restart") {
        return Err(format!(
            "`{action}` is not a supported service action. Use start, stop or restart."
        ));
    }
    if service.trim().is_empty() {
        return Err("A unit name is required.".into());
    }
    Ok(Cmd::new("systemctl")
        .map_err(|e| e.to_string())?
        .sudo()
        .arg(action)
        .arg(service))
}

async fn control(
    state: State<'_, AppState>,
    id: String,
    service: String,
    action: &str,
) -> Result<ServiceInfo, String> {
    let what = format!("{action}ing `{service}` on `{id}`");
    let session = session_for(&state, &id, &what).await?;
    let cmd = unit_command(action, &service)?;
    let rendered = cmd.render();
    let assessment = kyvon_security::classify(&rendered);

    let audit = AuditRepo::new(state.db.clone());
    let summary = format!("{action} {service}");
    let started = std::time::Instant::now();
    let result = session.exec(&cmd).await;
    let elapsed = started.elapsed().as_millis() as u64;

    let output = match result {
        Ok(o) => o,
        Err(e) => {
            let detail = e.to_string();
            record(
                &audit,
                &id,
                &summary,
                &rendered,
                &assessment,
                Outcome::Failure,
                None,
                &detail,
                elapsed,
            )
            .await;
            return Err(format!(
                "Could not {action} `{service}` on `{id}`: {detail}"
            ));
        }
    };

    if !output.success() {
        let detail = kyvon_core::redact(output.stderr.trim());
        record(
            &audit,
            &id,
            &summary,
            &rendered,
            &assessment,
            Outcome::Failure,
            output.exit_status,
            &detail,
            elapsed,
        )
        .await;
        return Err(format!(
            "`systemctl {action} {service}` failed on `{id}` (status {}). {detail}",
            output.exit_status.unwrap_or(255)
        ));
    }

    // §86: a write is not complete until its effect is confirmed. Re-read the
    // unit rather than assuming the exit code implies the intended state — a
    // unit can exit 0 and still fail to come up.
    let verified = verify(&session, &service).await;
    let detail = match &verified {
        Some(unit) => format!("{} is {}/{}", unit.unit, unit.active_state, unit.sub_state),
        None => "unit state could not be re-read after the change".to_string(),
    };
    record(
        &audit,
        &id,
        &summary,
        &rendered,
        &assessment,
        if verified.is_some() {
            Outcome::Success
        } else {
            Outcome::Unverified
        },
        output.exit_status,
        &detail,
        elapsed,
    )
    .await;

    verified.ok_or_else(|| {
        format!(
            "`systemctl {action} {service}` reported success on `{id}`, but the unit state could \
             not be read back, so the change is unverified. Check the unit directly."
        )
    })
}

/// Re-read one unit's current state.
async fn verify(session: &SshSession, service: &str) -> Option<ServiceInfo> {
    let cmd = Cmd::new("systemctl")
        .ok()?
        .args([
            "list-units",
            "--type=service",
            "--all",
            "--plain",
            "--no-legend",
            "--no-pager",
        ])
        .arg(service);
    let out = session.exec(&cmd).await.ok()?;
    kyvon_telemetry::commands::parse_systemctl_units(&out.stdout)
        .ok()?
        .into_iter()
        .find(|u| u.unit == service || u.unit == format!("{service}.service"))
}

#[allow(clippy::too_many_arguments)]
async fn record(
    audit: &AuditRepo,
    server_id: &str,
    summary: &str,
    command: &str,
    assessment: &RiskAssessment,
    outcome: Outcome,
    exit_status: Option<u32>,
    detail: &str,
    duration_ms: u64,
) {
    let event = AuditEvent::new(
        Some(server_id.to_string()),
        "service_control",
        summary,
        assessment.tier,
        outcome,
    )
    .with_command(command)
    .with_result(exit_status, detail, duration_ms);

    // An audit that cannot be written must not vanish silently, but it also
    // must not mask the operation's own result, so it is logged separately.
    if let Err(e) = audit.record(&event).await {
        tracing::error!("could not record audit for `{command}` on `{server_id}`: {e}");
    }
}
