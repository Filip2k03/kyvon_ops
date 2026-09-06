use crate::risk::RiskTier;
use crate::TimestampMs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpRole {
    Observer,
    Developer,
    Operator,
    Administrator,
}

impl McpRole {
    pub fn can_write(&self) -> bool {
        matches!(
            self,
            McpRole::Developer | McpRole::Operator | McpRole::Administrator
        )
    }

    pub fn can_deploy_production(&self) -> bool {
        matches!(self, McpRole::Operator | McpRole::Administrator)
    }

    pub fn can_administer(&self) -> bool {
        matches!(self, McpRole::Administrator)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EphemeralToken {
    pub token_id: String,
    pub server_id: String,
    pub scope: String,
    pub issued_at_ms: TimestampMs,
    pub expires_at_ms: TimestampMs,
}

impl EphemeralToken {
    pub fn is_valid(&self, now_ms: TimestampMs) -> bool {
        now_ms < self.expires_at_ms
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct McpApprovalRequest {
    pub request_id: String,
    pub server_id: String,
    pub actor: String,
    pub tool_name: String,
    pub operation_summary: String,
    pub risk_tier: RiskTier,
    pub proposed_commands: Vec<String>,
    pub expected_impact: String,
    pub requires_second_confirmation: bool,
    pub requires_backup_verification: bool,
    pub status: ApprovalStatus,
    pub created_at_ms: TimestampMs,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
    Expired,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct McpAuditEntry {
    pub id: String,
    pub timestamp_ms: TimestampMs,
    pub actor: String,
    pub client_type: String, // Codex Astra, Claude Opus, Agy Gemini 3.8, Human
    pub tool: String,
    pub server_id: String,
    pub arguments_redacted: serde_json::Value,
    pub risk_tier: RiskTier,
    pub approval_status: String,
    pub command_hash: Option<String>,
    pub result_summary: String,
    pub duration_ms: u64,
}
