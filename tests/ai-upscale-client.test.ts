import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiUpscaleClient, AI_MODELS } from '../src/services/ai-upscale-client';

describe('AiUpscaleClient (local edge-aware upscale, no backend)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    const mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ width: 2, height: 2, data: new Uint8ClampedArray(16) }))
    };
    const mockCanvas = {
      width: 2,
      height: 2,
      getContext: vi.fn(() => mockCtx)
    };

    // @ts-ignore
    global.document = {
      createElement: vi.fn((tag) => (tag === 'canvas' ? mockCanvas : {}))
    } as any;

    // @ts-ignore
    global.Image = class {
      public onload: any = null;
      public naturalWidth = 2;
      public naturalHeight = 2;
      set src(_val: string) {
        setTimeout(() => this.onload && this.onload(), 5);
      }
    } as any;
  });

  it('should upscale using the local algorithm and label the result honestly', async () => {
    const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = await AiUpscaleClient.upscale(dummyDataUrl, 'general-4x');

    expect(result.success).toBe(true);
    expect(result.scale).toBe(4);
    expect(result.model).toBe('4x 通用放大');
  });

  it('should cache repeated calls with the same payload and model', async () => {
    const dummyDataUrl = 'data:image/png;base64,dummyinput_unique_123';

    const result1 = await AiUpscaleClient.upscale(dummyDataUrl, 'fast-2x');
    expect(result1.success).toBe(true);
    expect(result1.scale).toBe(2);

    const result2 = await AiUpscaleClient.upscale(dummyDataUrl, 'fast-2x');
    expect(result2.success).toBe(true);
    expect(result2.cached).toBe(true);
  });

  it('should expose exactly the presets it actually implements', () => {
    expect(AI_MODELS.map((m) => m.id)).toEqual(['general-4x', 'lineart-4x', 'fast-2x']);
  });
});
