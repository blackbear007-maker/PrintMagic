import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeQualityClient } from '../src/services/free-quality-client';
import { NetworkGuard } from '../src/services/network-guard';

describe('FreeQualityClient (ARNIQA 微服務與本機像素統計評估雙通道)', () => {
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

    // @ts-ignore
    global.document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 10,
            height: 10,
            getContext: () => ({ putImageData: vi.fn() }),
            toDataURL: () => 'data:image/png;base64,mockcanvas'
          };
        }
        return {};
      }
    } as any;
  });

  const dummyImageData: ImageData = {
    width: 10,
    height: 10,
    data: new Uint8ClampedArray(10 * 10 * 4).fill(128),
    colorSpace: 'srgb'
  } as ImageData;

  it('should fall back to local pixel-stat assessment when Privacy Shield is enabled', async () => {
    NetworkGuard.setPrivacyShield(true);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await FreeQualityClient.assess(dummyImageData);
    expect(res.isCloud).toBe(false);
    expect(res.engine).toBe('本機像素統計評估');
    expect(res.score).toBeGreaterThanOrEqual(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should use the self-hosted ARNIQA service and map its 0-1 score onto the 0-100 scale', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        score: 0.82,
        scoreRange: '0-1 (higher = better perceived quality)',
        model: 'ARNIQA (koniq10k regressor)'
      })
    } as any);

    const res = await FreeQualityClient.assess(dummyImageData);
    expect(res.isCloud).toBe(true);
    expect(res.engine).toBe('自建 ARNIQA 服務');
    expect(res.score).toBe(82);
    expect(res.grade).toBe('GOOD');
  });

  it('should fall back gracefully to local assessment if ARNIQA is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ARNIQA service unavailable'));

    const res = await FreeQualityClient.assess(dummyImageData);
    expect(res.isCloud).toBe(false);
    expect(res.engine).toBe('本機像素統計評估');
    expect(res.score).toBeGreaterThanOrEqual(0);
  });

  it('should fall back gracefully if ARNIQA reports 503 unavailable (e.g. failed to load at startup)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, available: false, error: 'ARNIQA failed to load at startup' })
    } as any);

    const res = await FreeQualityClient.assess(dummyImageData);
    expect(res.isCloud).toBe(false);
    expect(res.engine).toBe('本機像素統計評估');
  });
});
