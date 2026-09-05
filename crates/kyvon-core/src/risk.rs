use serde::{Deserialize, Serialize};

/// How much damage an operation could do if it is wrong.
///
/// The tier drives how much friction the UI puts in front of execution. It is
/// deliberately *not* an authorisation mechanism (specification §36): nothing
/// executes without an explicit user confirmation regardless of tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskTier {
    /// Reads state. No side effects.
    Safe,
    /// Writes something trivially reversible.
    Low,
    /// Interrupts a running service or changes runtime state.
    Medium,
    /// Changes system configuration, packages, or access control.
    High,
    /// Can destroy data or lock the operator out of the host.
    Critical,
}

impl RiskTier {
    pub fn as_str(self) -> &'static str {
        match self {
            RiskTier::Safe => "safe",
            RiskTier::Low => "low",
            RiskTier::Medium => "medium",
            RiskTier::High => "high",
            RiskTier::Critical => "critical",
        }
    }

    /// Whether execution may proceed on a single click, or needs the operator
    /// to type the server alias to confirm.
    pub fn requires_typed_confirmation(self) -> bool {
        matches!(self, RiskTier::High | RiskTier::Critical)
    }

    /// `Safe` commands run from the palette without a preview modal; anything
    /// else is staged through the operation pipeline first.
    pub fn is_auto_executable(self) -> bool {
        matches!(self, RiskTier::Safe)
    }
}

/// The result of classifying a command, shown verbatim in the confirmation
/// modal so the operator can see the reasoning rather than a bare label.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub tier: RiskTier,
    /// The command exactly as it will be sent to the remote host.
    pub command: String,
    /// Why this tier was assigned, e.g. "restarts a running unit".
    pub reasons: Vec<String>,
    /// What the operator should expect to happen, e.g. "brief service
    /// interruption". Empty for `Safe`.
    pub expected_impact: Vec<String>,
    /// Patterns that could not be classified. A command containing an unknown
    /// construct is escalated rather than assumed benign.
    #[serde(default)]
    pub unknown_constructs: Vec<String>,
}

impl RiskAssessment {
    pub fn safe(command: impl Into<String>) -> Self {
        Self {
            tier: RiskTier::Safe,
            command: command.into(),
            reasons: vec!["reads system state without modifying it".into()],
            expected_impact: vec![],
            unknown_constructs: vec![],
        }
    }
}
