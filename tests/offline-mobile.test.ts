import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '../src/ui/state';
import { SubscriptionManager } from '../src/core/subscription-tier';
import { DpiCalculator } from '../src/core/dpi-calculator';
import { DEFAULT_PRESET } from '../src/core/presets';
import { TextInspector } from '../src/core/text-inspector';

describe('Mobile & 100% Offline Usability', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    // @ts-ignore
    global.localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; }
    } as any;

    store.setUiMode('simple');
    store.setEngineMode('local');
  });

  it('should operate 100% locally in Simple Mode with zero network dependencies', () => {
    const state = store.getState();
    expect(state.uiMode).toBe('simple');
    expect(state.engineMode).toBe('local');
    expect(state.aiUpscaleMode).toBe('local');

    // Verify local DPI calculation
    const dpiResult = DpiCalculator.analyze(1080, 1920, DEFAULT_PRESET);
    expect(dpiResult).toBeDefined();
    expect(typeof dpiResult.scaleFactor).toBe('number');

    // Verify local text spellchecking & OCR inspection
    const textCheck = TextInspector.verifyTextRegion({
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      text: 'SPECIAL COFEE',
      edgeScore: 0.3
    }, 1);
    expect(textCheck.isTypo).toBe(true);
    expect(textCheck.suggestion).toContain('COFFEE');
  });

  it('should allow all Pro & VIP features without online payment verification during growth phase', () => {
    expect(SubscriptionManager.ALL_FREE_UNLOCKED).toBe(true);
    expect(SubscriptionManager.canUseFeature('bleedExpander')).toBe(true);
    expect(SubscriptionManager.canUseFeature('aiMatting')).toBe(true);
    expect(SubscriptionManager.canUseFeature('aiVectorizer')).toBe(true);
  });
});
