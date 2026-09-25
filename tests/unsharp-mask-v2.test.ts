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
    // 2026-09-26: the old version used a 10|200 edge and asserted <= 10 / >= 200, which the untouched
    // input already satisfies — a no-op USM passed. Mid-tone step with headroom, pipeline settings.
    const w = 24;
    const h = 8;
    const src = makeTestImage(w, h, (i) => {
      const v = i % w < w / 2 ? 60 : 180;
      return [v, v, v];
    });

    const result = UnsharpMask.apply(src, 1.5, 1, 3);
    const at = (x: number) => result.data[(4 * w + x) * 4];

    // Overshoot on both sides of the edge (columns 11 | 12): the step gets steeper than the input.
    expect(at(11)).toBeLessThan(60 - 20);
    expect(at(12)).toBeGreaterThan(180 + 20);
    expect(at(12) - at(11)).toBeGreaterThan(120 + 40);
    // Flat areas away from the edge are left alone.
    expect(at(2)).toBe(60);
    expect(at(w - 3)).toBe(180);
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
