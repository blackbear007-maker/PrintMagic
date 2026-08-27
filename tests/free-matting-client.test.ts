import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeMattingClient } from '../src/services/free-matting-client';
import { NetworkGuard } from '../src/services/network-guard';

describe('FreeMattingClient (rembg u2netp 微服務與本機顏色距離去背雙通道)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    let storeMock: Record<string, string> = {};

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
      getImageData: vi.fn(() => ({ width: 4, height: 4, data: new Uint8ClampedArray(64) })),
      createImageData: vi.fn((w: number, h: number) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4),
        colorSpace: 'srgb'
      }))
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
    data: new Uint8ClampedArray(4 * 4 * 4).fill(120),
    colorSpace: 'srgb'
  } as ImageData;

  it('should fall back to the local color-distance matting when Privacy Shield is enabled', async () => {
    NetworkGuard.setPrivacyShield(true);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await FreeMattingClient.removeBackground(dummyImageData);
    expect(res.isCloud).toBe(false);
    expect(res.engine).toContain('本機顏色距離去背');
    expect(res.imageData.width).toBe(4);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should use the self-hosted rembg service when it succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        dataUrl: 'data:image/png;base64,rembg_output',
        engine: 'rembg u2netp (自建微服務)'
      })
    } as any);

    const res = await FreeMattingClient.removeBackground(dummyImageData);
    expect(res.isCloud).toBe(true);
    expect(res.engine).toContain('rembg');
  });

  it('should fall back gracefully if rembg reports 503 (session failed to initialize)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, error: 'rembg session failed to initialize' })
    } as any);

    const res = await FreeMattingClient.removeBackground(dummyImageData);
    expect(res.isCloud).toBe(false);
    expect(res.engine).toContain('本機顏色距離去背');
  });

  it('should fall back gracefully if the service is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('rembg service unavailable'));

    const res = await FreeMattingClient.removeBackground(dummyImageData);
    expect(res.isCloud).toBe(false);
    expect(res.imageData).toBeDefined();
  });
});
