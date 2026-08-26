import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeInpaintingClient } from '../src/services/free-inpainting-client';
import { NetworkGuard } from '../src/services/network-guard';

describe('FreeInpaintingClient (LaMa 微服務與本機 Navier-Stokes 畫布修復雙通道)', () => {
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

  // Each test uses a distinct fill value so FreeInpaintingClient's internal result cache
  // (keyed off the source pixel data) never lets one test's cached result leak into another.
  const makeSource = (fill: number): ImageData => ({
    width: 4,
    height: 4,
    data: new Uint8ClampedArray(4 * 4 * 4).fill(fill),
    colorSpace: 'srgb'
  } as ImageData);

  const dummyMask: ImageData = {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray(4 * 4 * 4).fill(255),
    colorSpace: 'srgb'
  } as ImageData;

  it('should fall back to the local Navier-Stokes eraser when Privacy Shield is enabled', async () => {
    NetworkGuard.setPrivacyShield(true);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await FreeInpaintingClient.eraseObject(makeSource(10), dummyMask);
    expect(res.isCloud).toBe(false);
    expect(res.modelUsed).toContain('Navier-Stokes');
    expect(res.imageData.width).toBe(4);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should use the self-hosted LaMa service when it succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        dataUrl: 'data:image/png;base64,lama_output',
        engine: 'LaMa (自建微服務)'
      })
    } as any);

    const res = await FreeInpaintingClient.eraseObject(makeSource(20), dummyMask);
    expect(res.isCloud).toBe(true);
    expect(res.modelUsed).toContain('LaMa');
  });

  it('should fall back gracefully if LaMa reports 503 (weights not sourced)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, error: 'LaMa weights not sourced' })
    } as any);

    const res = await FreeInpaintingClient.eraseObject(makeSource(30), dummyMask);
    expect(res.isCloud).toBe(false);
    expect(res.modelUsed).toContain('Navier-Stokes');
  });

  it('should fall back gracefully if the service is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('LaMa service unavailable'));

    const res = await FreeInpaintingClient.eraseObject(makeSource(40), dummyMask);
    expect(res.isCloud).toBe(false);
    expect(res.imageData).toBeDefined();
  });
});
