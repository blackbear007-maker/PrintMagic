import { describe, it, expect, beforeAll } from 'vitest';
import { AntiBandingFilter, buildIntegralImage, boxSum } from '../src/core/anti-banding';

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
 * 2026-08-28: the old dither formula `((x*12.9898 + y*78.233) % 1.0 - 0.5) * ditherAmp` was
 * missing the `sin()` and `43758.5453` terms a real GLSL hash needs — without them it's just a
 * fixed-slope ramp modulo 1, i.e. low-frequency and periodic, not noise at all. Measured via 2D
 * DFT: high/low frequency power ratio of ~0.47 (should be ≫1 for genuine high-frequency dither).
 * Replaced with a real void-and-cluster blue-noise tile (Ulichney 1993). These tests verify the
 * fix numerically instead of just trusting the algorithm looks right.
 */
describe('AntiBandingFilter — blue-noise dither spectrum', () => {
  function uniformGrayImage(size: number, gray = 128): ImageData {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      data[i * 4] = gray;
      data[i * 4 + 1] = gray;
      data[i * 4 + 2] = gray;
      data[i * 4 + 3] = 255;
    }
    // @ts-ignore
    return { data, width: size, height: size } as ImageData;
  }

  // Brute-force 2D DFT power at one frequency — the tile is only 32x32 (1024 samples), so this
  // is trivially fast and avoids pulling in an FFT dependency just for a test.
  function powerAt(data: Float64Array, size: number, fx: number, fy: number): number {
    let re = 0, im = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = data[y * size + x];
        const ang = -2 * Math.PI * (fx * x / size + fy * y / size);
        re += v * Math.cos(ang);
        im += v * Math.sin(ang);
      }
    }
    return re * re + im * im;
  }

  function highLowRatio(data: Float64Array, size: number): number {
    const nyquist = size / 2;
    let lowSum = 0, lowCount = 0, highSum = 0, highCount = 0;
    for (let fy = -nyquist + 1; fy < nyquist; fy++) {
      for (let fx = -nyquist + 1; fx < nyquist; fx++) {
        if (fx === 0 && fy === 0) continue; // skip DC
        const r = Math.sqrt(fx * fx + fy * fy);
        const p = powerAt(data, size, fx, fy);
        if (r <= nyquist * 0.25) { lowSum += p; lowCount++; }
        else if (r >= nyquist * 0.6) { highSum += p; highCount++; }
      }
    }
    return (highSum / highCount) / (lowSum / lowCount);
  }

  it('should inject genuinely high-frequency-dominant (blue-noise) dither, not a low-frequency ramp', () => {
    const size = 32;
    // A flat, fully uniform image: local mean == center pixel everywhere, so at strength=1 the
    // filter's smoothing term cancels out and the output deviation from 128 is pure dither signal.
    const img = uniformGrayImage(size, 128);
    const out = AntiBandingFilter.apply(img, 1.0);

    const deviation = new Float64Array(size * size);
    for (let i = 0; i < size * size; i++) {
      deviation[i] = out.data[i * 4] - 128;
    }

    // Sanity: dither actually did something (not all-zero).
    const nonZero = deviation.some((v) => v !== 0);
    expect(nonZero).toBe(true);

    const ratio = highLowRatio(deviation, size);
    // Real blue noise measures ~80x here; the old broken formula measured ~0.47 (low-frequency
    // dominant). A generous but decisive threshold that only genuine high-frequency dither passes.
    expect(ratio).toBeGreaterThan(5);
  });

  it('should preserve sharp edges and image dimensions (unaffected by the dither fix)', () => {
    const size = 40;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const isEdge = x >= size / 2;
        data[i] = isEdge ? 255 : 10;
        data[i + 1] = isEdge ? 0 : 10;
        data[i + 2] = isEdge ? 0 : 10;
        data[i + 3] = 255;
      }
    }
    // @ts-ignore
    const img = { data, width: size, height: size } as ImageData;
    const out = AntiBandingFilter.apply(img, 0.7);

    expect(out.width).toBe(size);
    expect(out.height).toBe(size);
    const edgeIdx = (20 * size + 35) * 4;
    expect(out.data[edgeIdx]).toBe(255);
    expect(out.data[edgeIdx + 1]).toBe(0);
  });
});

// 2026-08-28: the local-mean computation was rewritten from a per-pixel O(radius²) brute-force
// window scan to an O(1)-per-query integral image (summed-area table) — a real performance fix,
// but claimed to be mathematically EXACT (not an approximation). This directly verifies that
// claim against independently brute-force-computed box sums, rather than just trusting the
// derivation — this filter runs on every processed image by default (not an opt-in tool), so a
// silent behavior change here would be a real, widely-hitting regression.
describe('anti-banding integral image — exact equivalence to brute-force box sum', () => {
  it('should match a brute-force box sum for many random rectangles on a non-uniform image', () => {
    const w = 37, h = 29; // deliberately non-square, non-power-of-2
    const data = new Uint8ClampedArray(w * h * 4);
    // Deterministic pseudo-random-looking fill (no Math.random() per project convention).
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % 256;
    };
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = rand();
      data[i * 4 + 1] = rand();
      data[i * 4 + 2] = rand();
      data[i * 4 + 3] = 255;
    }

    const integral = buildIntegralImage(data, w, h, 0); // red channel

    function bruteForceSum(x0: number, y0: number, x1: number, y1: number): number {
      let sum = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          sum += data[(y * w + x) * 4];
        }
      }
      return sum;
    }

    const rects: [number, number, number, number][] = [
      [0, 0, 0, 0],           // single pixel, top-left corner
      [w - 1, h - 1, w - 1, h - 1], // single pixel, bottom-right corner
      [0, 0, w - 1, h - 1],   // whole image
      [5, 3, 20, 15],         // interior rectangle
      [0, 5, 10, 5],          // touches left edge
      [w - 8, 2, w - 1, 10],  // touches right edge
      [3, 0, 15, 4],          // touches top edge
      [3, h - 6, 15, h - 1]   // touches bottom edge
    ];

    for (const [x0, y0, x1, y1] of rects) {
      expect(boxSum(integral, w, x0, y0, x1, y1)).toBe(bruteForceSum(x0, y0, x1, y1));
    }
  });
});
