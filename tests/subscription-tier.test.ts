import { describe, it, expect, beforeEach } from 'vitest';
import { SUBSCRIPTION_PLANS, SubscriptionManager } from '../src/core/subscription-tier';

describe('SubscriptionManager (All Features Unlocked For Free Growth Phase)', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    // @ts-ignore
    global.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      }
    } as any;
  });

  it('should define 3 base tier definitions in registry', () => {
    expect(SUBSCRIPTION_PLANS.length).toBe(3);
    const freePlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'free')!;
    expect(freePlan.priceMonthly).toBe(0);
    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'pro')!;
    expect(proPlan.priceMonthly).toBe(399);
    const vipPlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'vip')!;
    expect(vipPlan.priceMonthly).toBe(699);
  });

  it('should unlock 100% of Pro and VIP features for free users during growth phase', () => {
    expect(SubscriptionManager.ALL_FREE_UNLOCKED).toBe(true);
    expect(SubscriptionManager.canUseFeature('vipAi')).toBe(true);
    expect(SubscriptionManager.canUseFeature('doubleSided')).toBe(true);
    expect(SubscriptionManager.canUseFeature('bleedExpander')).toBe(true);
    expect(SubscriptionManager.canUseFeature('aiMatting')).toBe(true);
    expect(SubscriptionManager.canUseFeature('aiVectorizer')).toBe(true);
    expect(SubscriptionManager.canUseFeature('pipelineCustomizer')).toBe(true);
    expect(SubscriptionManager.canUseFeature('pdfx')).toBe(true);
  });

  it('should provide unlimited quota during free growth phase', () => {
    expect(SubscriptionManager.consumeQuota(50)).toBe(true);
    const state = SubscriptionManager.getSubscriptionState();
    expect(state.isSubscribed).toBe(true);
    expect(state.monthlyQuotaRemaining).toBeGreaterThan(9000);
  });
});
