import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeVectorizeClient } from '../src/services/free-vectorize-client';
import { NetworkGuard } from '../src/services/network-guard';
import { QuotaRouter } from '../src/services/quota-router';

describe('FreeVectorizeClient (VTracer Rust 微服務與本機三次貝茲曲線雙通道)', () => {
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
    QuotaRouter.resetQuota();
    FreeVectorizeClient.clearCache();
  });

  // Mock a simple 10x10 ImageData
  const dummyImageData: ImageData = {
    width: 10,
    height: 10,
    data: new Uint8ClampedArray(10 * 10 * 4).fill(128),
    colorSpace: 'srgb'
  } as ImageData;

  it('should fall back to local Cubic Bézier engine when Privacy Shield is enabled', async () => {
    NetworkGuard.setPrivacyShield(true);

    const res = await FreeVectorizeClient.vectorizeImage(dummyImageData, 8, 1.5);
    expect(res.isCloud).toBe(false);
    expect(res.engineName).toContain('本機三次貝茲曲線');
    expect(res.svg).toContain('<svg');
  });

  it('should call VTracer backend and parse SVG result when service is online', async () => {
    const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L10,10" /></svg>';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        svg: mockSvg,
        elapsed_ms: 45
      })
    } as any);

    // @ts-ignore
    global.document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 10,
            height: 10,
            getContext: () => ({
              putImageData: vi.fn()
            }),
            toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          };
        }
        return {};
      }
    } as any;

    const res = await FreeVectorizeClient.vectorizeImage(dummyImageData, 8, 1.5);
    expect(res.svg).toBe(mockSvg);
    expect(res.isCloud).toBe(true);
    expect(res.engineName).toContain('VTracer Rust');
  });

  it('should fall back gracefully to local engine if VTracer microservice is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('VTracer 503 Service Unavailable'));

    const res = await FreeVectorizeClient.vectorizeImage(dummyImageData, 8, 1.5);
    expect(res.isCloud).toBe(false);
    expect(res.engineName).toContain('本機三次貝茲曲線');
    expect(res.svg).toContain('<svg');
  });
});
