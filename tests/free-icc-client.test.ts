import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeIccClient } from '../src/services/free-icc-client';
import { NetworkGuard } from '../src/services/network-guard';

describe('FreeIccClient (real LittleCMS 微服務，無本機備援)', () => {
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
      putImageData: vi.fn()
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
  });

  const dummyImageData: ImageData = {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray(4 * 4 * 4).fill(120),
    colorSpace: 'srgb'
  } as ImageData;

  const dummyProfileBytes = new TextEncoder().encode('fake-icc-bytes').buffer;

  it('should report unavailable (no local fallback) when Privacy Shield is enabled', async () => {
    NetworkGuard.setPrivacyShield(true);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await FreeIccClient.softProof(dummyImageData, dummyProfileBytes);
    expect(res.available).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should use the self-hosted LittleCMS service when it succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        dataUrl: 'data:image/png;base64,mockproofed',
        tac: { maxPercent: 212.2, meanPercent: 135.6, minPercent: 40.1 },
        profileName: 'Swop Standard / Agfa',
        engine: 'LittleCMS (自建微服務)'
      })
    } as any);

    const res = await FreeIccClient.softProof(dummyImageData, dummyProfileBytes);
    expect(res.available).toBe(true);
    expect(res.dataUrl).toBe('data:image/png;base64,mockproofed');
    expect(res.tac?.maxPercent).toBe(212.2);
    expect(res.profileName).toContain('Swop');
    expect(res.engine).toContain('LittleCMS');

    const [, opts] = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.image_base64).toBe('data:image/png;base64,mockcanvas');
    expect(typeof body.icc_profile_base64).toBe('string');
    expect(body.icc_profile_base64.length).toBeGreaterThan(0);
  });

  it('should report unavailable with the server error if the profile is rejected (400)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: 'Uploaded profile is a RGB profile, not CMYK' })
    } as any);

    const res = await FreeIccClient.softProof(dummyImageData, dummyProfileBytes);
    expect(res.available).toBe(false);
    expect(res.error).toContain('CMYK');
  });

  it('should report unavailable if the ICC engine reports 503 (LittleCMS not present)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, error: 'ICC engine (LittleCMS) not available in this build' })
    } as any);

    const res = await FreeIccClient.softProof(dummyImageData, dummyProfileBytes);
    expect(res.available).toBe(false);
  });

  it('should report unavailable if the service is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ICC service unavailable'));

    const res = await FreeIccClient.softProof(dummyImageData, dummyProfileBytes);
    expect(res.available).toBe(false);
  });
});
