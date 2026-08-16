import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DielineEngine } from '../src/core/dieline-engine';

describe('DielineEngine (White Ink Choke & 2mm CutContour Dieline)', () => {
  beforeEach(() => {
    const mockCtx = {
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      createImageData: vi.fn((w, h) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      }))
    };

    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: vi.fn(() => mockCtx)
    };

    // @ts-ignore
    global.document = {
      createElement: vi.fn((tagName: string) => {
        if (tagName === 'canvas') return mockCanvas;
        return {};
      }) as any
    };
  });

  it('should process transparent sticker image and generate 3 layers', () => {
    const w = 50;
    const h = 50;
    const data = new Uint8ClampedArray(w * h * 4);

    // Fill center 20x20 with solid color (alpha=255), leave outer area transparent (alpha=0)
    for (let y = 15; y < 35; y++) {
      for (let x = 15; x < 35; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 100;
        data[idx + 2] = 50;
        data[idx + 3] = 255;
      }
    }

    const imgData = { width: w, height: h, data } as ImageData;
    const output = DielineEngine.generateLayers(imgData, 2, 6);

    expect(output.hasTransparency).toBe(true);
    expect(output.totalSolidPixels).toBe(400);
    expect(output.cmykCanvas).toBeDefined();
    expect(output.whiteInkCanvas).toBeDefined();
    expect(output.cutContourCanvas).toBeDefined();
    expect(output.compositeCanvas).toBeDefined();
  });
});
