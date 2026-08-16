import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VIP_AI_MODELS, VipAiClient } from '../src/services/vip-ai-client';
import { SubscriptionManager } from '../src/core/subscription-tier';

describe('VipAiClient (High-End Paid API Engine: Fal.ai / Topaz / Replicate)', () => {
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

    // @ts-ignore
    global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 0));

    const mockElement = {
      className: '',
      appendChild: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() },
      remove: vi.fn(),
      addEventListener: vi.fn()
    };

    // @ts-ignore
    global.document = {
      createElement: vi.fn(() => mockElement),
      body: {
        appendChild: vi.fn()
      }
    } as any;
  });

  it('should define 3 core high-end VIP AI models', () => {
    expect(VIP_AI_MODELS.length).toBe(3);

    const clarity = VIP_AI_MODELS.find((m) => m.id === 'fal-clarity-8k')!;
    expect(clarity).toBeDefined();
    expect(clarity.provider).toContain('Fal.ai');

    const topaz = VIP_AI_MODELS.find((m) => m.id === 'topaz-photo-pro')!;
    expect(topaz).toBeDefined();
    expect(topaz.provider).toContain('Topaz');

    const replicate = VIP_AI_MODELS.find((m) => m.id === 'replicate-anime-pro')!;
    expect(replicate).toBeDefined();
    expect(replicate.provider).toContain('Replicate');
  });

  it('should reject VIP upscale if user is on Free plan', async () => {
    SubscriptionManager.setPlan('free');
    const dummyUrl = 'data:image/png;base64,dummy';
    const result = await VipAiClient.upscale(dummyUrl);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Requires VIP');
  });

  it('should process VIP upscale successfully when user is on VIP plan', async () => {
    SubscriptionManager.setPlan('vip');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        dataUrl: 'data:image/png;base64,vipresult'
      })
    });

    const mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ width: 4, height: 4, data: new Uint8ClampedArray(64) }))
    };
    const mockCanvas = {
      width: 4,
      height: 4,
      getContext: vi.fn(() => mockCtx)
    };

    // @ts-ignore
    global.document.createElement = vi.fn((tag) => (tag === 'canvas' ? mockCanvas : {})) as any;

    // @ts-ignore
    global.Image = class {
      public onload: any = null;
      public naturalWidth = 4;
      public naturalHeight = 4;
      set src(_val: string) {
        setTimeout(() => this.onload && this.onload(), 5);
      }
    } as any;

    const dummyUrl = 'data:image/png;base64,dummy';
    const result = await VipAiClient.upscale(dummyUrl, 'fal-clarity-8k');

    expect(result.success).toBe(true);
    expect(result.provider).toContain('Fal.ai');
    expect(SubscriptionManager.getQuotaUsed()).toBe(1);
  });
});
