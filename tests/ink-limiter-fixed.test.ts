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

/**
 * 2026-08-28: this file's own name and its old describe title ("Fixed CMYK ↔ RGB Formula (P0 Bug
 * Fix)") turned out to be describing the wrong fix. Its first test asserted that pure black
 * (0,0,0) *should* produce exactly 400% TAC — that was the actual bug (naive CMY double-counted
 * against a separately-added K), not the correct value. Real industry-standard TAC for pure
 * K-only black is 100%. See the fix note in src/core/ink-limiter.ts for the full explanation and
 * why InkLimiter now calls the same CmykEngine.rgbToCmyk() the app's real output uses, instead of
 * a disconnected formula of its own.
 */
describe('InkLimiter — GCR-aware TAC formula (corrected 2026-08-28)', () => {
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

  it('should NOT flag pure black as over-limit under the real adaptive-GCR separation', () => {
    // Pure black separates to mostly-K (grayComponent=1, adaptive GCR pushes most of it to K),
    // real TAC lands well under 200% — nowhere near the old (buggy) 400% figure.
    const img = solidColorImage(0, 0, 0);
    const result = InkLimiter.analyze(img, 300);
    expect(result.hasOverflow).toBe(false);
    expect(result.maxTotalInk).toBeLessThan(200);
    expect(result.exceededPixelCount).toBe(0);
  });

  it('should detect safe TAC on medium gray / white without overflow', () => {
    const img = solidColorImage(200, 200, 200);
    const result = InkLimiter.analyze(img, 300);
    expect(result.hasOverflow).toBe(false);
  });

  it('clampInk should not touch a fully saturated primary that is already under threshold', () => {
    // Pure red has zero gray component, so GCR does nothing to it: C=0%, M=100%, Y=100%, K=0% —
    // real TAC is ~200%, still under a 300% limit, so no modification should occur.
    const img = solidColorImage(255, 0, 0);
    const { clampedImageData, modifiedPixels } = InkLimiter.clampInk(img, 300);

    expect(modifiedPixels).toBe(0);
    expect(clampedImageData.data[0]).toBe(255);
    expect(clampedImageData.data[1]).toBe(0);
    expect(clampedImageData.data[2]).toBe(0);
  });

  it('clampInk should still clamp a genuinely over-limit color down to threshold and pass reanalysis', () => {
    // Pure red's ~200% real TAC exceeds a 150% threshold, so this should genuinely trigger
    // clamping (the pure-black case above no longer does, since it's honestly under threshold).
    const img = solidColorImage(255, 0, 0);
    const { clampedImageData, modifiedPixels } = InkLimiter.clampInk(img, 150);

    expect(modifiedPixels).toBe(100);
    const reAnalysis = InkLimiter.analyze(clampedImageData, 150);
    expect(reAnalysis.maxTotalInk).toBeLessThanOrEqual(150);
    expect(reAnalysis.hasOverflow).toBe(false);
  });
});
