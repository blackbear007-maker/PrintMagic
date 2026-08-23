import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VIP_AI_MODELS, VipAiClient } from '../src/services/vip-ai-client';
import { SubscriptionManager } from '../src/core/subscription-tier';

describe('VipAiClient (100% 開源自建頂級旗艦 AI 模型陣列: HAT-S / NAFNet / Anime4K)', () => {
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

  it('should define 3 core 100% open-source self-hosted VIP AI models', () => {
    expect(VIP_AI_MODELS.length).toBe(3);

    const hats = VIP_AI_MODELS.find((m) => m.id === 'hat-s-8k')!;
    expect(hats).toBeDefined();
    expect(hats.provider).toContain('PyTorch');

    const nafnet = VIP_AI_MODELS.find((m) => m.id === 'nafnet-scunet-pro')!;
    expect(nafnet).toBeDefined();
    expect(nafnet.provider).toContain('PyTorch');

    const anime = VIP_AI_MODELS.find((m) => m.id === 'anime4k-lineart-pro')!;
    expect(anime).toBeDefined();
    expect(anime.provider).toContain('WASM');
  });

  it('should allow all flagship AI upscaling during free beta growth phase', async () => {
    expect(SubscriptionManager.ALL_FREE_UNLOCKED).toBe(true);
    expect(SubscriptionManager.canUseFeature('vipAi')).toBe(true);
  });

  it('should process VIP upscale successfully using self-hosted pipeline', async () => {
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
    const result = await VipAiClient.upscale(dummyUrl, 'hat-s-8k');

    expect(result.success).toBe(true);
    expect(result.provider).toContain('PyTorch');
    expect(SubscriptionManager.getQuotaUsed()).toBe(1);
  });
});
