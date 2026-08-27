import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeFaceDetectClient } from '../src/services/free-face-detect-client';
import { NetworkGuard } from '../src/services/network-guard';

describe('FreeFaceDetectClient (YuNet 微服務，無本機備援)', () => {
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

  it('should report unavailable (no local fallback) when Privacy Shield is enabled', async () => {
    NetworkGuard.setPrivacyShield(true);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await FreeFaceDetectClient.detect(dummyImageData);
    expect(res.available).toBe(false);
    expect(res.faces).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should use the self-hosted YuNet service when it succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        faces: [{
          box: { x: 10, y: 20, width: 50, height: 60 },
          landmarks: {
            rightEye: [20, 30], leftEye: [40, 30], nose: [30, 40],
            rightMouth: [22, 55], leftMouth: [38, 55]
          },
          confidence: 0.9
        }],
        imageWidth: 4,
        imageHeight: 4
      })
    } as any);

    const res = await FreeFaceDetectClient.detect(dummyImageData);
    expect(res.available).toBe(true);
    expect(res.faces).toHaveLength(1);
    expect(res.faces[0].confidence).toBe(0.9);
    expect(res.engine).toContain('YuNet');
  });

  it('should report unavailable if YuNet reports 503 (weights not present)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, error: 'YuNet weights not present' })
    } as any);

    const res = await FreeFaceDetectClient.detect(dummyImageData);
    expect(res.available).toBe(false);
    expect(res.faces).toEqual([]);
  });

  it('should report unavailable if the service is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('YuNet service unavailable'));

    const res = await FreeFaceDetectClient.detect(dummyImageData);
    expect(res.available).toBe(false);
    expect(res.faces).toEqual([]);
  });
});
