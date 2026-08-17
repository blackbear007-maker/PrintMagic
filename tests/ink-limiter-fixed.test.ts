import { describe, it, expect, beforeAll } from 'vitest';
import { InkLimiter } from '../src/core/ink-limiter';

// Polyfill ImageData for Node/vitest environment
beforeAll(() => {
  if (typeof global.ImageData === 'undefined') {
    // @ts-ignore
    global.ImageData = class {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    } as any;
  }
});

describe('InkLimiter — Fixed CMYK ↔ RGB Formula (P0 Bug Fix)', () => {
  function solidColorImage(r: number, g: number, b: number, count = 100): ImageData {
    const data = new Uint8ClampedArray(count * 4);
    for (let i = 0; i < count; i++) {
      data[i * 4]     = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    // @ts-ignore
    return { data, width: 10, height: 10 } as ImageData;
  }

  it('should correctly detect over-limit on pure black (0,0,0) → 400% TAC > 300% limit', () => {
    // Pure black in unseparated RGB → C=1, M=1, Y=1, K=1 → TAC = 400%
    const img = solidColorImage(0, 0, 0);
    const result = InkLimiter.analyze(img, 300);
    expect(result.hasOverflow).toBe(true);
    expect(result.maxTotalInk).toBe(400);
    expect(result.exceededPixelCount).toBe(100);
  });

  it('should detect safe TAC on medium gray / white without overflow', () => {
    const img = solidColorImage(200, 200, 200);
    const result = InkLimiter.analyze(img, 300);
    expect(result.hasOverflow).toBe(false);
  });

  it('clampInk should restore pixel colors without darkening artifacts from wrong formula', () => {
    // Saturated red: should not cause excessive color shift after clamping
    const img = solidColorImage(255, 0, 0);
    const { clampedImageData, modifiedPixels } = InkLimiter.clampInk(img, 300);

    // Pure red at 100% C = 0, M = 0, Y = 0, K = 0 → TAC = 0, no modification needed
    expect(modifiedPixels).toBe(0);
    expect(clampedImageData.data[0]).toBe(255);
    expect(clampedImageData.data[1]).toBe(0);
    expect(clampedImageData.data[2]).toBe(0);
  });

  it('clampInk should bring 400% TAC black down to threshold and pass reanalysis', () => {
    const img = solidColorImage(0, 0, 0);
    const { clampedImageData, modifiedPixels } = InkLimiter.clampInk(img, 300);

    expect(modifiedPixels).toBe(100);
    const reAnalysis = InkLimiter.analyze(clampedImageData, 300);
    expect(reAnalysis.maxTotalInk).toBeLessThanOrEqual(300);
    expect(reAnalysis.hasOverflow).toBe(false);
  });
});
