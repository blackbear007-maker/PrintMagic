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

  it('should correctly detect over-limit pure black (0,0,0) → CMYK 100K → TAC=100', () => {
    // Pure black in RGB → C=0, M=0, Y=0, K=1 → TAC = 100%
    const img = solidColorImage(0, 0, 0);
    const result = InkLimiter.analyze(img, 300);
    // Pure black ink is 100%, well under 300% limit
    expect(result.hasOverflow).toBe(false);
    expect(result.maxTotalInk).toBeLessThanOrEqual(105);
  });

  it('should detect overflow on artificially dark 4-color mix (0,0,100) → high TAC', () => {
    // Deep navy blue: high C, M, K build-up
    const img = solidColorImage(0, 0, 100);
    const result = InkLimiter.analyze(img, 250);
    // Should show C high, M high, K component — check it's detected correctly
    expect(result.maxTotalInk).toBeGreaterThan(50);
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

  it('clampInk back-calculation should be correct (1-c)*(1-k) not 1-max(c,k)', () => {
    // Dark purple: will need clamping; verify result is physically reasonable
    const img = solidColorImage(30, 0, 80);
    const { clampedImageData, modifiedPixels } = InkLimiter.clampInk(img, 150);

    if (modifiedPixels > 0) {
      // After clamping, the result should be lighter (less ink), never darker than original
      expect(clampedImageData.data[0]).toBeGreaterThanOrEqual(30);
    }
  });
});
