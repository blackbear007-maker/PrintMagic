import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiUpscaleClient, AI_MODELS } from '../src/services/ai-upscale-client';
import { store } from '../src/ui/state';

describe('AiUpscaleClient (self-hosted Real-ESRGAN / local edge-aware fallback)', () => {
  let storeMock: Record<string, string> = {};

  beforeEach(() => {
    // Service path only runs in 自建服務 (cloud) engine mode; local mode never uploads.
    store.setState({ engineMode: 'cloud' });
    vi.restoreAllMocks();
    storeMock = {};

    // @ts-ignore
    global.localStorage = {
      getItem: (k: string) => storeMock[k] || null,
      setItem: (k: string, v: string) => { storeMock[k] = v; },
      removeItem: (k: string) => { delete storeMock[k]; },
      clear: () => { storeMock = {}; }
    } as any;

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

  it('reports the real Real-ESRGAN scale relative to the original, not a fixed 4x, when the upload was downscaled', async () => {
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, dataUrl: 'data:image/png;base64,realesrgan_output_big' })
    } as any);
    // 原圖 3000px，上傳縮到 1200px，服務輸出 4800px -> 實際 1.6x
    // @ts-ignore
    global.Image = class {
      public onload: any = null;
      public naturalWidth = 3000;
      public naturalHeight = 3000;
      set src(_val: string) {
        setTimeout(() => this.onload && this.onload(), 5);
      }
    } as any;
    // @ts-ignore
    (global.document.createElement('canvas') as any).getContext('2d').getImageData
      .mockReturnValue({ width: 4800, height: 4800, data: new Uint8ClampedArray(4) });

    const result = await AiUpscaleClient.upscale('data:image/png;base64,big_original_for_scale_check', 'general-4x');
    expect(result.success).toBe(true);
    expect(result.model).toContain('Real-ESRGAN');
    expect(result.scale).toBe(1.6);
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

    // 服務回傳 8px 寬、原圖 2px 寬 -> 實際倍率 4
    // @ts-ignore
    (global.document.createElement('canvas') as any).getContext('2d').getImageData
      .mockReturnValue({ width: 8, height: 8, data: new Uint8ClampedArray(256) });

    const dummyDataUrl = 'data:image/png;base64,unique_cloud_upscale_input';
    const result = await AiUpscaleClient.upscale(dummyDataUrl, 'general-4x');

    expect(result.success).toBe(true);
    expect(result.scale).toBe(4);
    expect(result.model).toContain('Real-ESRGAN');
    expect(result.dataUrl).toBe('data:image/png;base64,realesrgan_output');
  });

  it('should skip the network entirely and go straight to local in local engine mode', async () => {
    store.setState({ engineMode: 'local' });
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
