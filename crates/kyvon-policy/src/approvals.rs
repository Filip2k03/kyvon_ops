use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;
use kyvon_core::mcp::{ApprovalStatus, McpApprovalRequest};
use kyvon_core::risk::RiskTier;

pub struct ApprovalGate {
    pending: Mutex<HashMap<String, McpApprovalRequest>>,
}

impl ApprovalGate {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
        }
    }

    pub fn assess_operation_risk(tool_name: &str, target_env: Option<&str>) -> RiskTier {
        match tool_name {
            // Read-only tools are safe
            s if s.starts_with("kyvon_server_") || s.starts_with("kyvon_site_") || s.starts_with("kyvon_diagnose_") || s.starts_with("kyvon_topology_") => {
                RiskTier::Safe
            }
            "kyvon_reload_nginx" => RiskTier::Low,
            "kyvon_restart_service" => {
                if target_env == Some("production") || target_env == Some("prod") {
                    RiskTier::High
                } else {
                    RiskTier::Medium
                }
            }
            "kyvon_deploy" => {
                if target_env == Some("production") || target_env == Some("prod") {
                    RiskTier::High
                } else {
                    RiskTier::Medium
                }
            }
            "kyvon_rollback" => RiskTier::High,
            "kyvon_drain_workload" | "kyvon_drop_database" | "kyvon_flush_firewall" => RiskTier::Critical,
            _ => RiskTier::High,
        }
    }

    pub fn create_request(
        &self,
        server_id: &str,
        actor: &str,
        tool_name: &str,
        summary: &str,
        risk_tier: RiskTier,
        commands: Vec<String>,
        expected_impact: &str,
    ) -> McpApprovalRequest {
        let request_id = format!("req_{}", Uuid::new_v4().simple());
        let requires_second_confirmation = risk_tier == RiskTier::Critical;
        let requires_backup_verification = risk_tier == RiskTier::Critical || tool_name.contains("database") || tool_name.contains("deploy");

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
            req.status = if approve {
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
        let lock = self.pending.lock().unwrap();
        lock.values().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gates_production_deployment() {
        let gate = ApprovalGate::new();
        let risk = ApprovalGate::assess_operation_risk("kyvon_deploy", Some("production"));
        assert_eq!(risk, RiskTier::High);

        let req = gate.create_request(
            "prod-01",
            "Claude Code",
            "kyvon_deploy",
            "Deploy shop-api v1.8.3",
            risk,
            vec!["git pull".into(), "docker compose up -d".into()],
            "Zero downtime rolling restart",
        );

        assert_eq!(req.status, ApprovalStatus::Pending);
        assert!(req.requires_backup_verification);

        let resolved = gate.resolve_request(&req.request_id, true).unwrap();
        assert_eq!(resolved.status, ApprovalStatus::Approved);
    }
}
