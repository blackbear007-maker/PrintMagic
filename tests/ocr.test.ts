import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeOcrClient } from '../src/services/free-ocr-client';
import { NetworkGuard } from '../src/services/network-guard';

describe('FreeOcrClient (self-hosted Tesseract + Privacy Shield)', () => {
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
    FreeOcrClient.clearCache();
  });

  const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('should never call /api/ocr when Privacy Shield is active, and return no tokens', async () => {
    NetworkGuard.setPrivacyShield(true);

    let networkCalled = false;
    global.fetch = vi.fn().mockImplementation(async () => {
      networkCalled = true;
      return { ok: false, status: 404 };
    });

    const res = await FreeOcrClient.extractTextLayers(dummyDataUrl, 1000, 1000);

    expect(networkCalled).toBe(false);
    expect(res.isCloud).toBe(false);
    expect(res.tokens.length).toBe(0);
  });

  it('should call the self-hosted Tesseract endpoint and return real recognized text when Privacy Shield is off', async () => {
    NetworkGuard.setPrivacyShield(false);

    let tesseractCalled = false;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/ocr') {
        tesseractCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            text: '印刷 測試 樣張 2026',
            lang: 'chi_tra+eng',
            elapsed_ms: 120
          })
        };
      }
      return { ok: false, status: 404 };
    });

    const res = await FreeOcrClient.extractTextLayers(dummyDataUrl, 1000, 1000);

    expect(tesseractCalled).toBe(true);
    expect(res.isCloud).toBe(true);
    expect(res.tokens.length).toBeGreaterThan(0);
    expect(res.tokens.map(t => t.text)).toContain('印刷');
  });

  it('should return no tokens (no local text-recognition fallback) when the self-hosted service is unreachable', async () => {
    NetworkGuard.setPrivacyShield(false);

    global.fetch = vi.fn().mockImplementation(async () => ({ ok: false, status: 503 }));

    const res = await FreeOcrClient.extractTextLayers(dummyDataUrl, 800, 600);
    expect(res.isCloud).toBe(false);
    expect(res.tokens.length).toBe(0);
  });
});
