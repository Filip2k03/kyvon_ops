export type RiskTier = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  tier: RiskTier;
  impact: string;
  requiresConfirmation: boolean;
}