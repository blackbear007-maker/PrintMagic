import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiMatting } from '../src/core/ai-matting';

describe('AiMatting (Hair-Level Alpha Background Removal)', () => {
  beforeEach(() => {
    const mockCtx = {
      createImageData: vi.fn((w, h) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      })),
      putImageData: vi.fn()
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

  it('should remove background color and extract transparent alpha matte', () => {
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
    const result = AiMatting.removeBackground(srcImg, 30);

    expect(result.dataUrl).toBeDefined();
    expect(result.hasTransparency).toBe(true);
  });
});
