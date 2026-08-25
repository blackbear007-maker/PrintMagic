import { describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionManager } from '../src/core/subscription-tier';

describe('SubscriptionManager (no tiering — everything unlocked)', () => {
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

  it('should report all features unlocked', () => {
    expect(SubscriptionManager.ALL_FREE_UNLOCKED).toBe(true);
    expect(SubscriptionManager.canUseFeature('vipAi')).toBe(true);
    expect(SubscriptionManager.canUseFeature('doubleSided')).toBe(true);
    expect(SubscriptionManager.canUseFeature('bleedExpander')).toBe(true);
    expect(SubscriptionManager.canUseFeature('aiMatting')).toBe(true);
    expect(SubscriptionManager.canUseFeature('aiVectorizer')).toBe(true);
    expect(SubscriptionManager.canUseFeature('pipelineCustomizer')).toBe(true);
    expect(SubscriptionManager.canUseFeature('pdfx')).toBe(true);
  });

  it('should report a subscribed, unlocked access state', () => {
    const state = SubscriptionManager.getSubscriptionState();
    expect(state.isSubscribed).toBe(true);
    expect(state.planName).toBeTruthy();
  });
});
