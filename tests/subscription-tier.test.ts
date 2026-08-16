import { describe, it, expect, beforeEach } from 'vitest';
import { SUBSCRIPTION_PLANS, SubscriptionManager } from '../src/core/subscription-tier';

describe('SubscriptionManager (Free 0 / Pro 399 / VIP 699)', () => {
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

  it('should define exactly 3 tiers with correct pricing', () => {
    expect(SUBSCRIPTION_PLANS.length).toBe(3);

    const freePlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'free')!;
    expect(freePlan.priceMonthly).toBe(0);
    expect(freePlan.doubleSidedAllowed).toBe(false);
    expect(freePlan.vipAiAllowed).toBe(false);

    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'pro')!;
    expect(proPlan.priceMonthly).toBe(399);
    expect(proPlan.doubleSidedAllowed).toBe(true);
    expect(proPlan.pdfxExportAllowed).toBe(true);
    expect(proPlan.vipAiAllowed).toBe(false);

    const vipPlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'vip')!;
    expect(vipPlan.priceMonthly).toBe(699);
    expect(vipPlan.vipAiAllowed).toBe(true);
    expect(vipPlan.monthlyAiQuota).toBe(500);
  });

  it('should default to Free plan and allow upgrading to Pro and VIP', () => {
    expect(SubscriptionManager.getCurrentPlanId()).toBe('free');
    expect(SubscriptionManager.canUseFeature('vipAi')).toBe(false);

    SubscriptionManager.setPlan('pro');
    expect(SubscriptionManager.getCurrentPlanId()).toBe('pro');
    expect(SubscriptionManager.canUseFeature('doubleSided')).toBe(true);
    expect(SubscriptionManager.canUseFeature('vipAi')).toBe(false);

    SubscriptionManager.setPlan('vip');
    expect(SubscriptionManager.getCurrentPlanId()).toBe('vip');
    expect(SubscriptionManager.canUseFeature('vipAi')).toBe(true);
  });

  it('should track quota usage accurately', () => {
    SubscriptionManager.setPlan('vip');
    expect(SubscriptionManager.getQuotaUsed()).toBe(0);

    const ok1 = SubscriptionManager.consumeQuota(10);
    expect(ok1).toBe(true);
    expect(SubscriptionManager.getQuotaUsed()).toBe(10);

    const state = SubscriptionManager.getSubscriptionState();
    expect(state.monthlyQuotaRemaining).toBe(490);
  });
});
