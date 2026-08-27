import { describe, it, expect, beforeEach, vi } from 'vitest';

// smartcrop.js's real algorithm samples pixel data through a real browser canvas 2D context,
// which isn't meaningfully emulable in this test environment (and exercising its own saliency
// algorithm is smartcrop's own test suite's job, not ours). This test instead verifies OUR
// integration code: canvas construction, face-boost mapping, and result field passthrough.
const mockSmartcropCrop = vi.fn();
vi.mock('smartcrop', () => ({
  default: { crop: (...args: any[]) => mockSmartcropCrop(...args) }
}));

const mockDetect = vi.fn();
vi.mock('../src/services/free-face-detect-client', () => ({
  FreeFaceDetectClient: { detect: (...args: any[]) => mockDetect(...args) }
}));

import { SmartCropClient } from '../src/services/smart-crop-client';

describe('SmartCropClient (smartcrop.js 包裝，best-effort YuNet 人臉加權)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSmartcropCrop.mockReset();
    mockDetect.mockReset();

    const mockCtx = { putImageData: vi.fn() };
    const mockCanvas = { width: 0, height: 0, getContext: vi.fn(() => mockCtx) };

    // @ts-ignore
    global.document = {
      createElement: vi.fn((tag: string) => (tag === 'canvas' ? mockCanvas : {}))
    } as any;
  });

  const dummyImageData: ImageData = {
    width: 400,
    height: 300,
    data: new Uint8ClampedArray(400 * 300 * 4),
    colorSpace: 'srgb'
  } as ImageData;

  it('suggests a crop without face boost when YuNet finds nothing', async () => {
    mockDetect.mockResolvedValue({ available: true, faces: [], engine: 'YuNet (自建服務)' });
    mockSmartcropCrop.mockResolvedValue({ topCrop: { x: 10, y: 5, width: 200, height: 150 } });

    const res = await SmartCropClient.suggestCrop(dummyImageData, 200, 150);

    expect(res.usedFaceBoost).toBe(false);
    expect(res.engine).toBe('smartcrop.js');
    expect(res.crop).toEqual({ x: 10, y: 5, width: 200, height: 150 });
    expect(mockSmartcropCrop).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 200, height: 150, boost: [] })
    );
  });

  it('feeds detected faces into smartcrop as boost regions', async () => {
    mockDetect.mockResolvedValue({
      available: true,
      faces: [{ box: { x: 50, y: 40, width: 60, height: 70 }, landmarks: {} as any, confidence: 0.9 }],
      engine: 'YuNet (自建服務)'
    });
    mockSmartcropCrop.mockResolvedValue({ topCrop: { x: 0, y: 0, width: 200, height: 150 } });

    const res = await SmartCropClient.suggestCrop(dummyImageData, 200, 150);

    expect(res.usedFaceBoost).toBe(true);
    expect(res.engine).toContain('YuNet');
    expect(mockSmartcropCrop).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        boost: [{ x: 50, y: 40, width: 60, height: 70, weight: 1.0 }]
      })
    );
  });

  it('still works when face detection is unavailable', async () => {
    mockDetect.mockResolvedValue({ available: false, faces: [], engine: 'YuNet 服務離線' });
    mockSmartcropCrop.mockResolvedValue({ topCrop: { x: 0, y: 0, width: 200, height: 150 } });

    const res = await SmartCropClient.suggestCrop(dummyImageData, 200, 150);
    expect(res.usedFaceBoost).toBe(false);
    expect(res.crop).toEqual({ x: 0, y: 0, width: 200, height: 150 });
  });

  it('still works when face detection throws', async () => {
    mockDetect.mockRejectedValue(new Error('network error'));
    mockSmartcropCrop.mockResolvedValue({ topCrop: { x: 0, y: 0, width: 200, height: 150 } });

    const res = await SmartCropClient.suggestCrop(dummyImageData, 200, 150);
    expect(res.usedFaceBoost).toBe(false);
    expect(res.crop).toEqual({ x: 0, y: 0, width: 200, height: 150 });
  });
});
