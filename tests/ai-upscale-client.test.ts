import { describe, it, expect, vi } from 'vitest';
import { AiUpscaleClient } from '../src/services/ai-upscale-client';

describe('AiUpscaleClient (Free Real-ESRGAN Cloud & Local Fallback v2)', () => {
  it('should gracefully fallback to local engine when network fails or times out', async () => {
    // Mock fetch to simulate offline / server timeout
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error or server offline'));

    const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = await AiUpscaleClient.upscale(dummyDataUrl);

    expect(result.success).toBe(true);
    expect(result.fallbackToLocal).toBe(true);
    expect(result.model).toContain('本機 RealESRGAN 加速');
  });

  it('should return reconstructed image data when API responds with success and cache subsequent calls', async () => {
    const dummyOutputDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9Qz8DAwMDABAAAAAwBAgB6vM7SAAAAAElFTkSuQmCC';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        dataUrl: dummyOutputDataUrl,
        model: 'Real-ESRGAN 4x+ (Deep Learning)',
        scale: 4
      })
    });

    // Mock Image decoding for node runtime
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

    const dummyDataUrl = 'data:image/png;base64,dummyinput_unique_123';
    const result1 = await AiUpscaleClient.upscale(dummyDataUrl);

    expect(result1.success).toBe(true);
    expect(result1.scale).toBe(4);

    // Second call with same dataUrl should hit LRU cache instantly with cached: true
    const result2 = await AiUpscaleClient.upscale(dummyDataUrl);
    expect(result2.success).toBe(true);
    expect(result2.cached).toBe(true);
  });
});
