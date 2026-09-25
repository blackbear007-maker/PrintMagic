import { describe, it, expect } from 'vitest';
import { AntiBandingFilter } from '../src/core/anti-banding';
import { AiMatting } from '../src/core/ai-matting';

describe('Advanced Pre-Press Commercial Models Suite', () => {
  // Helper to make dummy ImageData in Node test environment
  const createMockImageData = (w: number, h: number, fillR = 255, fillG = 255, fillB = 255, fillA = 255): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fillR;
      data[i + 1] = fillG;
      data[i + 2] = fillB;
      data[i + 3] = fillA;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  // ─── 2. Anti-Banding & Gradient De-Ringing Smoothing Filter ───────────────
  it('should preserve sharp high-contrast line edges while smoothing gradient areas', () => {
    const img = createMockImageData(50, 50);
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 25; x++) {
        const idx = (y * 50 + x) * 4;
        const val = Math.floor(x / 5) * 20;
        img.data[idx] = val;
        img.data[idx + 1] = val;
        img.data[idx + 2] = val;
      }
      for (let x = 25; x < 50; x++) {
        const idx = (y * 50 + x) * 4;
        img.data[idx] = 255;
        img.data[idx + 1] = 0;
        img.data[idx + 2] = 0;
      }
    }

    const filtered = AntiBandingFilter.apply(img, 0.7);
    expect(filtered.width).toBe(50);
    expect(filtered.height).toBe(50);
    // 2026-08-28: the original assertion checked (x=35, y=25) — deep inside the flat red region,
    // nowhere near the real gray/red boundary at x=24|25. It only passed because the old (broken)
    // dither formula happened to round to a 0 offset at that exact coordinate; a real blue-noise
    // dither legitimately perturbs flat regions by ±1 there, which is the fix working as intended,
    // not a regression. The real edge to check is the actual high-contrast boundary itself.
    const edgePixelIdx = (25 * 50 + 25) * 4;
    expect(filtered.data[edgePixelIdx]).toBe(255);
    expect(filtered.data[edgePixelIdx + 1]).toBe(0);
  });

  // ─── Corner-sampling robustness (5x5 block avg vs. a single noisy pixel) ──
  it('AiMatting: a single noisy pixel exactly at the corner should not skew the whole background estimate', () => {
    const w = 50, h = 50;
    const img = createMockImageData(w, h, 250, 250, 250); // near-white background
    // Foreground subject clearly different from background
    for (let y = 15; y < 35; y++) {
      for (let x = 15; x < 35; x++) {
        const idx = (y * w + x) * 4;
        img.data[idx] = 10;
        img.data[idx + 1] = 10;
        img.data[idx + 2] = 10;
      }
    }
    const clean = AiMatting.removeBackground(img, 25);

    // Corrupt exactly the top-left corner pixel to a color far from both bg and fg
    const noisy = createMockImageData(w, h, 250, 250, 250);
    for (let y = 15; y < 35; y++) {
      for (let x = 15; x < 35; x++) {
        const idx = (y * w + x) * 4;
        noisy.data[idx] = 10;
        noisy.data[idx + 1] = 10;
        noisy.data[idx + 2] = 10;
      }
    }
    noisy.data[0] = 0;
    noisy.data[1] = 255;
    noisy.data[2] = 0;
    const withNoise = AiMatting.removeBackground(noisy, 25);

    // A pixel in the middle of the clean background area should stay classified as background
    // (transparent) in both cases — a single-pixel corner sample would have shifted the whole
    // background-color estimate toward green and misclassified real background pixels.
    const midBgIdx = (2 * w + 25) * 4; // y=2 x=25, clearly background, far from the corrupted corner
    expect(clean.imageData.data[midBgIdx + 3]).toBe(0);
    expect(withNoise.imageData.data[midBgIdx + 3]).toBe(0);
  });
});
