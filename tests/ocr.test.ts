import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeOcrClient } from '../src/services/free-ocr-client';
import { NetworkGuard } from '../src/services/network-guard';
import { SubscriptionManager } from '../src/core/subscription-tier';

describe('FreeOcrClient (70/30 智慧分流、隱私盾聯動與會員權限)', () => {
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
    // Default subscription
    SubscriptionManager.setPlan('free');
  });

  const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('should restrict Privacy Shield feature to PRO and VIP plans only in plan definition', () => {
    expect(SubscriptionManager.isPlanFeatureAllowed('free', 'privacyShield')).toBe(false);
    expect(SubscriptionManager.isPlanFeatureAllowed('pro', 'privacyShield')).toBe(true);
    expect(SubscriptionManager.isPlanFeatureAllowed('vip', 'privacyShield')).toBe(true);
  });

  it('should route 100% to self-hosted Tesseract and NEVER call external APIs when Privacy Shield is active', async () => {
    NetworkGuard.setPrivacyShield(true);

    let externalApiCalled = false;
    let internalTesseractCalled = false;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('googleapis.com') || url.includes('ocr.space')) {
        externalApiCalled = true;
        return { ok: true, json: async () => ({}) };
      }
      if (url === '/api/ocr') {
        internalTesseractCalled = true;
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

    expect(externalApiCalled).toBe(false);
    expect(internalTesseractCalled).toBe(true);
    expect(res.isCloud).toBe(true);
    expect(res.engineName).toContain('100% 離線隱私保護盾');
    expect(res.tokens.length).toBeGreaterThan(0);
    expect(res.tokens.map(t => t.text)).toContain('印刷');
  });

  it('should failover to self-hosted Tesseract if external OCR.space API returns error in normal mode', async () => {
    NetworkGuard.setPrivacyShield(false);

    let tesseractCalled = false;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('ocr.space')) {
        // External fails with 429
        return { ok: false, status: 429 };
      }
      if (url === '/api/ocr') {
        tesseractCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            text: '備援 成功',
            lang: 'chi_tra+eng',
            elapsed_ms: 90
          })
        };
      }
      return { ok: false, status: 404 };
    });

    const res = await FreeOcrClient.extractTextLayers(dummyDataUrl, 800, 600);
    expect(tesseractCalled).toBe(true);
    expect(res.isCloud).toBe(true);
    expect(res.tokens.length).toBe(2);
  });
});
