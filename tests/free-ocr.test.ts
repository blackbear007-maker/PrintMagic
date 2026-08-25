import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FreeOcrClient } from '../src/services/free-ocr-client';

describe('FreeOcrClient (100% 離線私有 Tesseract 5.3 & PP-OCR Client)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract text layers correctly using self-hosted Tesseract microservice', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/ocr')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            text: 'PRINTMAGIC STUDIO',
            lang: 'chi_tra+eng',
            elapsed_ms: 45
          })
        };
      }
      return { ok: false, status: 404 };
    }) as any;

    const result = await FreeOcrClient.extractTextLayers(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      1000,
      1000
    );

    expect(result).toBeDefined();
    expect(result.tokens).toBeDefined();
    expect(result.tokens.length).toBeGreaterThan(0);
    expect(result.tokens[0].text).toBe('PRINTMAGIC');
    expect(result.engineName).toContain('PP-OCRv5');
  });

  it('should fall back gracefully to local positioning if network fails', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network offline'));

    const result = await FreeOcrClient.extractTextLayers(
      'data:image/png;base64,unique_fallback_test_payload',
      800,
      800
    );

    expect(result).toBeDefined();
    expect(result.tokens).toBeDefined();
    expect(result.isCloud).toBe(false);
  });
});
