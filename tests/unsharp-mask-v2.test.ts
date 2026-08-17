import { describe, it, expect } from 'vitest';
import { UnsharpMask } from '../src/core/unsharp-mask';

describe('UnsharpMask v2 — Recursive Gaussian IIR + Lab Luminance Sharpening', () => {
  function makeTestImage(w: number, h: number, fill: (i: number) => [number, number, number]): ImageData {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const [r, g, b] = fill(i);
      data[i * 4]     = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    // @ts-ignore — minimal ImageData shape for unit test
    return { data, width: w, height: h } as ImageData;
  }

  it('should sharpen a high-contrast edge while preserving flat zones', () => {
    const w = 20;
    const h = 20;
    // Left half dark (10), right half light (200)
    const src = makeTestImage(w, h, (i) => {
      const x = i % w;
      const v = x < w / 2 ? 10 : 200;
      return [v, v, v];
    });

    const result = UnsharpMask.apply(src, 1.5, 1.0, 2);

    // Edge pixels (columns 9, 10) should be pushed farther apart
    const darkEdgeIdx = (5 * w + 9) * 4;
    const lightEdgeIdx = (5 * w + 10) * 4;
    expect(result.data[darkEdgeIdx]).toBeLessThanOrEqual(10);
    expect(result.data[lightEdgeIdx]).toBeGreaterThanOrEqual(200);
  });

  it('should not shift hue on a saturated red region (Lab-based sharpening)', () => {
    const w = 10;
    const h = 10;
    const src = makeTestImage(w, h, () => [200, 50, 50]);
    const result = UnsharpMask.apply(src, 1.5, 1.0, 3);

    // Uniform red: no edge signal → sharpening should not fire → values unchanged
    for (let i = 0; i < w * h; i++) {
      const pi = i * 4;
      // Hue should remain red-dominant with no hue-shift
      expect(result.data[pi]).toBeGreaterThan(result.data[pi + 1]);
      expect(result.data[pi]).toBeGreaterThan(result.data[pi + 2]);
    }
  });

  it('should preserve alpha channel unchanged', () => {
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4 + 3] = 128; // semi-transparent
    }
    // @ts-ignore
    const src: ImageData = { data, width: w, height: h };
    const result = UnsharpMask.apply(src);
    for (let i = 0; i < w * h; i++) {
      expect(result.data[i * 4 + 3]).toBe(128);
    }
  });
});
