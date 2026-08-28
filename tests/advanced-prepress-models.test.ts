import { describe, it, expect } from 'vitest';
import { PantoneMatcher } from '../src/core/pantone-matcher';
import { AntiBandingFilter } from '../src/core/anti-banding';
import { PerspectiveRectifier } from '../src/core/perspective-rectifier';
import { EdgeChokeMatting } from '../src/core/edge-choke-matting';
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

  // ─── 1. Pantone Spot Color Matcher & CIELAB ΔE2000 ─────────────────────────
  it('should accurately match red RGB (#E4002B) to Pantone 185 C with low Delta E', () => {
    const match = PantoneMatcher.matchRgb(228, 0, 43); // Classic Red
    expect(match.pantone.code).toBe('Pantone 185 C');
    expect(match.deltaE).toBeLessThan(3.0);
    expect(match.accuracy).toBe('exact');
  });

  it('should match gold tones to Pantone Metallic Gold (Pantone 871 C)', () => {
    const match = PantoneMatcher.matchRgb(132, 117, 78); // Pale Gold
    expect(match.pantone.category).toBe('metallic');
    expect(match.pantone.code).toBe('Pantone 871 C');
  });

  it('should extract top dominant Pantone spot colors from image', () => {
    const img = createMockImageData(60, 60, 218, 24, 132); // Barbie pink
    const spots = PantoneMatcher.extractDominantSpotColors(img, 3);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots[0].pantone.code).toBe('Pantone 219 C');
  });

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

  // ─── 3. DocFlatten & Perspective Rectifier Engine ────────────────────────
  it('should calculate projective homography and rectify quadrilateral coordinates', () => {
    const img = createMockImageData(100, 100);
    const corners = {
      topLeft: { x: 10, y: 15 },
      topRight: { x: 90, y: 5 },
      bottomRight: { x: 95, y: 85 },
      bottomLeft: { x: 5, y: 95 }
    };

    const rectified = PerspectiveRectifier.rectify(img, corners, 80, 80);
    expect(rectified.width).toBe(80);
    expect(rectified.height).toBe(80);
  });

  it('should throw a clear error instead of silently returning garbage for a degenerate (collinear) quad', () => {
    const img = createMockImageData(100, 100);
    const collinear = {
      topLeft: { x: 10, y: 50 },
      topRight: { x: 40, y: 50 },
      bottomRight: { x: 70, y: 50 },
      bottomLeft: { x: 100, y: 50 }
    };
    expect(() => PerspectiveRectifier.rectify(img, collinear, 80, 80)).toThrow(/degenerate/i);
  });

  it('should throw a clear error for a quad with a near-zero-length edge', () => {
    const img = createMockImageData(100, 100);
    const zeroEdge = {
      topLeft: { x: 10, y: 10 },
      topRight: { x: 10.5, y: 10.2 }, // topLeft -> topRight edge is ~0.5px
      bottomRight: { x: 90, y: 90 },
      bottomLeft: { x: 10, y: 90 }
    };
    expect(() => PerspectiveRectifier.rectify(img, zeroEdge, 80, 80)).toThrow(/degenerate/i);
  });

  it('should still accept a legitimately thin (but non-degenerate) quad', () => {
    const img = createMockImageData(200, 200);
    const thinButValid = {
      topLeft: { x: 10, y: 50 },
      topRight: { x: 190, y: 50 },
      bottomRight: { x: 190, y: 60 },
      bottomLeft: { x: 10, y: 60 }
    };
    expect(() => PerspectiveRectifier.rectify(img, thinButValid, 100, 10)).not.toThrow();
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

  it('EdgeChokeMatting: a single noisy pixel exactly at the corner should not skew the whole background estimate', () => {
    const w = 50, h = 50;
    const makeImg = (corrupt: boolean) => {
      const img = createMockImageData(w, h, 250, 250, 250);
      for (let y = 15; y < 35; y++) {
        for (let x = 15; x < 35; x++) {
          const idx = (y * w + x) * 4;
          img.data[idx] = 10;
          img.data[idx + 1] = 10;
          img.data[idx + 2] = 10;
        }
      }
      if (corrupt) {
        img.data[0] = 0;
        img.data[1] = 255;
        img.data[2] = 0;
      }
      return img;
    };

    const clean = EdgeChokeMatting.extractMatting(makeImg(false), 0.5, false);
    const withNoise = EdgeChokeMatting.extractMatting(makeImg(true), 0.5, false);

    const midBgIdx = 2 * w + 25;
    // Background alpha should stay low in both cases, not spike because a corrupted single-pixel
    // corner sample pulled the whole background-color baseline toward an unrelated color.
    expect(withNoise.alphaMask[midBgIdx]).toBeLessThan(60);
    expect(Math.abs(withNoise.alphaMask[midBgIdx] - clean.alphaMask[midBgIdx])).toBeLessThan(20);
  });

  // ─── 4. Edge-Choke Color-Distance Matting ──────────────────────────────────
  it('should extract alpha transparency and de-contaminate background fringe', () => {
    const img = createMockImageData(50, 50, 255, 255, 255); // White background
    for (let y = 15; y < 35; y++) {
      for (let x = 15; x < 35; x++) {
        const idx = (y * 50 + x) * 4;
        img.data[idx] = 10;
        img.data[idx + 1] = 10;
        img.data[idx + 2] = 10;
      }
    }

    const result = EdgeChokeMatting.extractMatting(img, 0.5, true);
    expect(result.mattedImageData.width).toBe(50);
    expect(result.hairlineFidelityScore).toBeGreaterThan(80);
    expect(result.alphaMask.length).toBe(2500);
  });
});
