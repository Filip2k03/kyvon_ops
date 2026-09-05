use kyvon_core::mcp::{ApprovalStatus, McpApprovalRequest};
use kyvon_core::risk::RiskTier;
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

const APPROVAL_TTL_MS: i64 = 60_000;

/// What an actor is asking to do, as one named value.
///
/// The fields are passed by name rather than position deliberately: four of
/// them are `&str`, and this is the gate that decides whether a write reaches
/// a host. A transposed `server_id` and `actor` would silently attribute an
/// operation to the wrong target, which no type check would catch.
pub struct ApprovalProposal<'a> {
    pub server_id: &'a str,
    pub actor: &'a str,
    pub tool_name: &'a str,
    pub summary: &'a str,
    pub risk_tier: RiskTier,
    pub commands: Vec<String>,
    pub expected_impact: &'a str,
}

pub struct ApprovalGate {
    pending: Mutex<HashMap<String, McpApprovalRequest>>,
}

impl Default for ApprovalGate {
    fn default() -> Self {
        Self::new()
    }
}

impl ApprovalGate {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
        }
    }

    pub fn assess_operation_risk(tool_name: &str, target_env: Option<&str>) -> RiskTier {
        if crate::tools::get_kyvon_mcp_tools()
            .iter()
            .any(|tool| tool.name == tool_name && tool.is_read_only)
        {
            return RiskTier::Safe;
        }
        match tool_name {
            "kyvon_reload_nginx" => RiskTier::Low,
            "kyvon_restart_service" => {
                if matches!(target_env, Some("staging" | "development" | "dev" | "test")) {
                    RiskTier::Medium
                } else {
                    RiskTier::High
                }
            }
            "kyvon_deploy" => {
                if matches!(target_env, Some("staging" | "development" | "dev" | "test")) {
                    RiskTier::Medium
                } else {
                    RiskTier::High
                }
            }
            "kyvon_rollback" => RiskTier::High,
            "kyvon_drain_workload" | "kyvon_drop_database" | "kyvon_flush_firewall" => {
                RiskTier::Critical
            }
            _ => RiskTier::High,
        }
    }

    pub fn create_request(&self, proposal: ApprovalProposal<'_>) -> McpApprovalRequest {
        let ApprovalProposal {
            server_id,
            actor,
            tool_name,
            summary,
            risk_tier,
            commands,
            expected_impact,
        } = proposal;

        let request_id = format!("req_{}", Uuid::new_v4().simple());
        let requires_second_confirmation = risk_tier == RiskTier::Critical;
        let requires_backup_verification = risk_tier == RiskTier::Critical
            || tool_name.contains("database")
            || tool_name.contains("deploy");

        let req = McpApprovalRequest {
            request_id: request_id.clone(),
            server_id: server_id.to_string(),
            actor: actor.to_string(),
            tool_name: tool_name.to_string(),
            operation_summary: summary.to_string(),
            risk_tier,
            proposed_commands: commands,
            expected_impact: expected_impact.to_string(),
            requires_second_confirmation,
            requires_backup_verification,
            status: ApprovalStatus::Pending,
            created_at_ms: kyvon_core::now_ms(),
        };

        let mut lock = self.pending.lock().unwrap();
        lock.insert(request_id, req.clone());
        req
    }

    pub fn resolve_request(&self, request_id: &str, approve: bool) -> Option<McpApprovalRequest> {
        let mut lock = self.pending.lock().unwrap();
        if let Some(mut req) = lock.remove(request_id) {
            let age = kyvon_core::now_ms().checked_sub(req.created_at_ms);
            req.status = if !age.is_some_and(|age| (0..APPROVAL_TTL_MS).contains(&age)) {
                ApprovalStatus::Expired
            } else if approve {
                ApprovalStatus::Approved
            } else {
                ApprovalStatus::Rejected
            };
            Some(req)
        } else {
            None
        }
    }

    pub fn get_pending(&self) -> Vec<McpApprovalRequest> {
        let mut lock = self.pending.lock().unwrap();
        let now = kyvon_core::now_ms();
        lock.retain(|_, req| {
            now.checked_sub(req.created_at_ms)
                .is_some_and(|age| (0..APPROVAL_TTL_MS).contains(&age))
        });
        lock.values().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_tools_and_environments_never_inherit_safe_risk() {
        assert_eq!(
            ApprovalGate::assess_operation_risk("kyvon_server_delete", None),
            RiskTier::High
        );
        for env in [None, Some("PRODUCTION"), Some("unknown"), Some("")] {
            assert_eq!(
                ApprovalGate::assess_operation_risk("kyvon_deploy", env),
                RiskTier::High
            );
        }
        assert_eq!(
            ApprovalGate::assess_operation_risk("kyvon_incident_list", None),
            RiskTier::Safe
        );
    }

    #[test]
    fn gates_production_deployment() {
        let gate = ApprovalGate::new();
        let risk = ApprovalGate::assess_operation_risk("kyvon_deploy", Some("production"));
        assert_eq!(risk, RiskTier::High);

        let req = gate.create_request(ApprovalProposal {
            server_id: "prod-01",
            actor: "Claude Opus",
            tool_name: "kyvon_deploy",
            summary: "Deploy shop-api v1.8.3",
            risk_tier: risk,
            commands: vec!["git pull".into(), "docker compose up -d".into()],
            expected_impact: "Zero downtime rolling restart",
        });

        assert_eq!(req.status, ApprovalStatus::Pending);
        assert!(req.requires_backup_verification);

        let resolved = gate.resolve_request(&req.request_id, true).unwrap();
        assert_eq!(resolved.status, ApprovalStatus::Approved);
        assert!(gate.resolve_request(&req.request_id, true).is_none());
    }

    #[test]
    fn expired_or_future_dated_approvals_cannot_authorize_a_write() {
        let gate = ApprovalGate::new();
        for created_at in [kyvon_core::now_ms() - APPROVAL_TTL_MS, i64::MAX] {
            let req = gate.create_request(ApprovalProposal {
                server_id: "prod-01",
                actor: "Claude Opus",
                tool_name: "kyvon_reload_nginx",
                summary: "Reload nginx",
                risk_tier: RiskTier::Low,
                commands: vec![],
                expected_impact: "Reload",
            });
            gate.pending
                .lock()
                .unwrap()
                .get_mut(&req.request_id)
                .unwrap()
                .created_at_ms = created_at;
            assert_eq!(
                gate.resolve_request(&req.request_id, true).unwrap().status,
                ApprovalStatus::Expired
            );
            assert!(gate.resolve_request(&req.request_id, true).is_none());
        }
    }
}
