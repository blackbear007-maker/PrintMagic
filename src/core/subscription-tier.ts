/**
 * PrintMagic Access State
 *
 * There is currently no Free/Pro/VIP paywall. This used to carry a 3-tier plan table (NT$0 /
 * NT$399 / NT$699) with per-feature gating flags, but that table was never rendered anywhere in
 * the UI (PricingModal has always shown its own "Public Beta, everything free" copy independently
 * of this file) and every gate check was already short-circuited true by ALL_FREE_UNLOCKED. It was
 * dead, misleading weight — removed rather than kept as decoration. If paid tiers come back later,
 * rebuild this with real gating wired to real UI, not aspirational data nothing reads.
 */

export interface AppAccessState {
  planName: string;
  isSubscribed: boolean;
}

export class SubscriptionManager {
  /**
   * All features are unlocked for everyone right now — no tiering.
   */
  public static readonly ALL_FREE_UNLOCKED = true;

  public static getSubscriptionState(): AppAccessState {
    return {
      planName: '全功能開放體驗（無分級）',
      isSubscribed: true
    };
  }

  /**
   * Kept for call-site compatibility — always true, there is nothing to gate right now.
   */
  public static canUseFeature(_feature: string): boolean {
    return true;
  }
}
