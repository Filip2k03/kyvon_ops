import { DonationTier, StripeCheckoutPayload } from './types';

export const DONATION_TIERS: DonationTier[] = [
  {
    id: 'tier-coffee',
    amount: 5,
    name: 'Coffee Boost',
    description: 'Fuel a late-night debugging session for KyvonOPS open-source core.',
    perk: 'Supporter badge on release notes & discord',
  },
  {
    id: 'tier-server',
    amount: 10,
    name: 'Server Supporter',
    description: 'Covers 1 month of test VPS nodes for multi-distribution Musl builds.',
    perk: 'Direct feature priority vote in community roadmap',
  },
  {
    id: 'tier-enthusiast',
    amount: 15,
    name: 'DevOps Enthusiast',
    description: 'Powers ongoing automated static analysis & security regression runs.',
    perk: 'Access to early nightly builds & private beta channels',
    popular: true,
  },
  {
    id: 'tier-architect',
    amount: 25,
    name: 'Architect Patron',
    description: 'Sponsors dedicated hardware testing for high-throughput cgroups v2 telemetry.',
    perk: 'Named sponsor on GitHub README and App credits',
  },
];

export class StripeClient {
  private publishableKey: string;
  private checkoutEndpoint?: string;

  constructor(publishableKey?: string, checkoutEndpoint?: string) {
    this.publishableKey = publishableKey || 'pk_test_TYooMQauvdEDq54NiTphI7jx';
    this.checkoutEndpoint = checkoutEndpoint || 'https://buy.stripe.com/test_donate';
  }

  /**
   * Generates a direct payment link or initiates an online checkout session
   */
  async createCheckoutSession(payload: StripeCheckoutPayload): Promise<{ checkoutUrl: string; sessionId?: string }> {
    if (this.checkoutEndpoint && !this.checkoutEndpoint.includes('buy.stripe.com')) {
      // Direct custom backend checkout session initiation
      const response = await fetch(this.checkoutEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.publishableKey}`,
        },
        body: JSON.stringify({
          amount: Math.round(payload.amountUsd * 100), // in cents
          currency: payload.currency || 'usd',
          donor_name: payload.donorName,
          donor_email: payload.donorEmail,
          note: payload.message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Stripe Checkout initiation failed: ${response.statusText}`);
      }

      const data = await response.json();
      return { checkoutUrl: data.url, sessionId: data.id };
    }

    // Direct Stripe Hosted Checkout link with query parameters
    const params = new URLSearchParams({
      amount: (payload.amountUsd * 100).toString(),
      prefilled_email: payload.donorEmail || '',
      client_reference_id: payload.donorName || 'anonymous_supporter',
    });

    const checkoutUrl = `https://checkout.stripe.com/pay/cs_test_kyvon_${payload.amountUsd}?${params.toString()}`;
    return { checkoutUrl };
  }
}
