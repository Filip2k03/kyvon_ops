/**
 * Mirror of `crates/kyvon-core/src/risk.rs`.
 *
 * Kept in step with the Rust type by `kyvon-core/tests/schema.rs`, which
 * compares these field names against the JSON serde actually emits.
 */

/** `#[serde(rename_all = "snake_case")]` on the Rust enum. */
export type RiskTier = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/**
 * What `kyvon_security::classify` decided about a command line.
 *
 * The tier authorises nothing. It decides how much the operator is shown and
 * how deliberate their confirmation has to be — which is why the assessment
 * carries its reasoning rather than a single boolean: an operator confirming a
 * destructive command should be able to see *why* it was classified that way.
 *
 * This interface previously declared `impact: string` and
 * `requiresConfirmation: boolean`, neither of which the backend has ever sent.
 */
export interface RiskAssessment {
  tier: RiskTier;
  /** The command exactly as it will be sent to the remote host. */
  command: string;
  /** Why this tier was assigned, e.g. "restarts a running unit". */
  reasons: string[];
  /** What to expect, e.g. "brief service interruption". Empty for `safe`. */
  expected_impact: string[];
  /**
   * Constructs the classifier could not read — command substitution, `eval`,
   * an unrecognised program. Their presence is why a tier was escalated, so
   * they are shown rather than hidden.
   */
  unknown_constructs: string[];
}
