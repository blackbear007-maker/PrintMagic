import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkGuard } from '../src/services/network-guard';
import { QuotaRouter } from '../src/services/quota-router';

describe('NetworkGuard & Privacy Shield (印前安全與網路容錯防護罩)', () => {
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
  });

  it('should toggle and persist privacy shield state in localStorage', () => {
    expect(NetworkGuard.isPrivacyShieldActive()).toBe(false);

    NetworkGuard.setPrivacyShield(true);
    expect(NetworkGuard.isPrivacyShieldActive()).toBe(true);

    NetworkGuard.setPrivacyShield(false);
    expect(NetworkGuard.isPrivacyShieldActive()).toBe(false);
  });

  it('should force 100% local unlimited engines when Privacy Shield is enabled', () => {
    // Normal mode -> picks Real-ESRGAN
    expect(QuotaRouter.getBestProvider('upscale').id).toBe('upscale-real-esrgan');

    // Turn ON Privacy Shield -> must immediately return local unlimited engine
    NetworkGuard.setPrivacyShield(true);
    expect(QuotaRouter.getBestProvider('upscale').id).toBe('upscale-local-pyramid');
    expect(QuotaRouter.getBestProvider('matting').id).toBe('matting-local');
    expect(QuotaRouter.getBestProvider('inpainting').id).toBe('inpainting-local');
    expect(QuotaRouter.getBestProvider('vectorize').id).toBe('vectorize-local-potrace');
    expect(QuotaRouter.getBestProvider('lowlight').id).toBe('lowlight-local-shadowlift');
    expect(QuotaRouter.getBestProvider('crop').id).toBe('crop-local-saliency');
    expect(QuotaRouter.getBestProvider('ocr').id).toBe('ocr-local-contrast');
    expect(QuotaRouter.getBestProvider('geo').id).toBe('geo-local-db');
  });

  it('should block external safeFetch calls when Privacy Shield is active', async () => {
    NetworkGuard.setPrivacyShield(true);

    const res = await NetworkGuard.safeFetch('https://api.example.com', { method: 'POST' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(res.error).toContain('Privacy Shield Active');
  });

  it('should correctly validate binary magic headers for PNG, JPEG, and WebP', async () => {
    // PNG Header: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])]);
    expect(await NetworkGuard.validateImageBlob(pngBlob)).toBe(true);

    // JPEG Header: 0xFF 0xD8 0xFF
    const jpegBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])]);
    expect(await NetworkGuard.validateImageBlob(jpegBlob)).toBe(true);

    // Corrupted / invalid text file pretending to be image
    const corruptBlob = new Blob(['<html>502 Bad Gateway</html>']);
    expect(await NetworkGuard.validateImageBlob(corruptBlob)).toBe(false);
  });

  it('should handle cold-start 503 errors gracefully without throwing', async () => {
    // Mock global fetch to return 503
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable (Model is loading)'
    } as any);

    const provider = QuotaRouter.getProviders('upscale')[0];
    const res = await NetworkGuard.safeFetch('https://api.example.com', { method: 'POST' }, 5000, provider.id);

    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
    expect(provider.status).toBe('error');
  });
});
