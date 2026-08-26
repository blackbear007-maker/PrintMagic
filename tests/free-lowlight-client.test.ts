import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeLowlightClient } from '../src/services/free-lowlight-client';
import { NetworkGuard } from '../src/services/network-guard';

describe('FreeLowlightClient (Retinexformer 微服務與本機曲線估計雙通道)', () => {
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
      getImageData: vi.fn(() => ({ width: 4, height: 4, data: new Uint8ClampedArray(64) }))
    };
    const mockCanvas = {
      width: 4,
      height: 4,
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => 'data:image/png;base64,mockcanvas')
    };

    // @ts-ignore
    global.document = {
      createElement: vi.fn((tag: string) => (tag === 'canvas' ? mockCanvas : {}))
    } as any;

    // @ts-ignore
    global.Image = class {
      public onload: any = null;
      public naturalWidth = 4;
      public naturalHeight = 4;
      set src(_val: string) {
        setTimeout(() => this.onload && this.onload(), 5);
      }
    } as any;
  });

  const dummyImageData: ImageData = {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray(4 * 4 * 4).fill(30),
    colorSpace: 'srgb'
  } as ImageData;

  it('should fall back to the local curve-estimation enhancer when Privacy Shield is enabled', async () => {
    NetworkGuard.setPrivacyShield(true);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await FreeLowlightClient.enhance(dummyImageData);
    expect(res.isCloud).toBe(false);
    expect(res.engine).toContain('本機曲線估計');
    expect(res.imageData.width).toBe(4);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should use the self-hosted Retinexformer service when it succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        dataUrl: 'data:image/png;base64,retinexformer_output',
        engine: 'Retinexformer (自建微服務)'
      })
    } as any);

    const res = await FreeLowlightClient.enhance(dummyImageData);
    expect(res.isCloud).toBe(true);
    expect(res.engine).toContain('Retinexformer');
  });

  it('should fall back gracefully if Retinexformer reports 503 (weights not sourced)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, available: false, error: 'Retinexformer weights not sourced' })
    } as any);

    const res = await FreeLowlightClient.enhance(dummyImageData);
    expect(res.isCloud).toBe(false);
    expect(res.engine).toContain('本機曲線估計');
  });

  it('should fall back gracefully if the service is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Retinexformer service unavailable'));

    const res = await FreeLowlightClient.enhance(dummyImageData);
    expect(res.isCloud).toBe(false);
    expect(res.imageData).toBeDefined();
  });
});
