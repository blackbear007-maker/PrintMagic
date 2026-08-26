import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiUpscaleClient, AI_MODELS } from '../src/services/ai-upscale-client';
import { NetworkGuard } from '../src/services/network-guard';

describe('AiUpscaleClient (self-hosted Real-ESRGAN / local edge-aware fallback)', () => {
  let storeMock: Record<string, string> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    storeMock = {};

    // @ts-ignore
    global.localStorage = {
      getItem: (k: string) => storeMock[k] || null,
      setItem: (k: string, v: string) => { storeMock[k] = v; },
      removeItem: (k: string) => { delete storeMock[k]; },
      clear: () => { storeMock = {}; }
    } as any;
    NetworkGuard.setPrivacyShield(false);

    const mockCtx = {
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn(() => ({ width: 2, height: 2, data: new Uint8ClampedArray(16) }))
    };
    const mockCanvas = {
      width: 2,
      height: 2,
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => 'data:image/png;base64,mockcanvas')
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

    // Default: no fetch mock set -> throws -> falls through to local, matching an unreachable service
    // @ts-ignore
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch not mocked for this test'));
  });

  it('should fall back to the local edge-aware algorithm when the self-hosted service is unreachable', async () => {
    const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = await AiUpscaleClient.upscale(dummyDataUrl, 'general-4x');

    expect(result.success).toBe(true);
    expect(result.scale).toBe(4);
    expect(result.model).toBe('4x 通用放大');
  });

  it('should use the self-hosted Real-ESRGAN service and label the result honestly when it succeeds', async () => {
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        dataUrl: 'data:image/png;base64,realesrgan_output',
        engine: 'Real-ESRGAN compact x4v3 (自建微服務)'
      })
    } as any);

    const dummyDataUrl = 'data:image/png;base64,unique_cloud_upscale_input';
    const result = await AiUpscaleClient.upscale(dummyDataUrl, 'general-4x');

    expect(result.success).toBe(true);
    expect(result.scale).toBe(4);
    expect(result.model).toContain('Real-ESRGAN');
    expect(result.dataUrl).toBe('data:image/png;base64,realesrgan_output');
  });

  it('should skip the network entirely and go straight to local when Privacy Shield is active', async () => {
    NetworkGuard.setPrivacyShield(true);
    const fetchSpy = global.fetch as any;

    const dummyDataUrl = 'data:image/png;base64,privacy_shield_input';
    const result = await AiUpscaleClient.upscale(dummyDataUrl, 'fast-2x');

    expect(result.success).toBe(true);
    expect(result.model).toBe('2x 快速放大');
    expect(fetchSpy).not.toHaveBeenCalled();
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
