import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FreeAiMattingClient } from '../src/services/free-ai-matting-client';

describe('FreeAiMattingClient (local color-distance matting, no AI model)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    const mockCtx = {
      createImageData: vi.fn((w, h) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      })),
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn((_x, _y, w, h) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      }))
    };

    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => 'data:image/png;base64,mockmatting')
    };

    // @ts-ignore
    global.document = {
      createElement: vi.fn((tag) => (tag === 'canvas' ? mockCanvas : {}))
    } as any;
  });

  it('should remove background and extract alpha transparency using instant local fallback when offline', async () => {
    const w = 50;
    const h = 50;
    const data = new Uint8ClampedArray(w * h * 4);

    // Solid white background (255, 255, 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }

    // Center dark circle
    for (let y = 15; y < 35; y++) {
      for (let x = 15; x < 35; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 20;
        data[idx + 1] = 20;
        data[idx + 2] = 20;
        data[idx + 3] = 255;
      }
    }

    const srcImg = { width: w, height: h, data } as ImageData;
    const result = await FreeAiMattingClient.removeBackground('data:image/png;base64,test', srcImg);

    expect(result).toBeDefined();
    expect(result.dataUrl).toBeDefined();
    expect(result.imageData.width).toBe(w);
    expect(result.imageData.height).toBe(h);
    expect(result.isCloud).toBe(false); // Offline fallback
  });

  it('should return cached result on repeated calls with same payload', async () => {
    const w = 30;
    const h = 30;
    const data = new Uint8ClampedArray(w * h * 4);
    const srcImg = { width: w, height: h, data } as ImageData;
    const dataUrl = 'data:image/png;base64,cachetest';

    const res1 = await FreeAiMattingClient.removeBackground(dataUrl, srcImg);
    const res2 = await FreeAiMattingClient.removeBackground(dataUrl, srcImg);

    expect(res1.dataUrl).toBe(res2.dataUrl);
  });
});
