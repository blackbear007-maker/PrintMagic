import { describe, it, expect } from 'vitest';
import { PantoneMatcher } from '../src/core/pantone-matcher';
import { AntiBandingFilter } from '../src/core/anti-banding';
import { PerspectiveRectifier } from '../src/core/perspective-rectifier';
import { BiRefNetMatting } from '../src/core/birefnet-matting';

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
    const edgePixelIdx = (25 * 50 + 35) * 4;
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

  // ─── 4. BiRefNet-Lite Saliency & Alpha Boundary Matting ────────────────────
  it('should extract alpha transparency and de-contaminate background fringe using BiRefNet', () => {
    const img = createMockImageData(50, 50, 255, 255, 255); // White background
    for (let y = 15; y < 35; y++) {
      for (let x = 15; x < 35; x++) {
        const idx = (y * 50 + x) * 4;
        img.data[idx] = 10;
        img.data[idx + 1] = 10;
        img.data[idx + 2] = 10;
      }
    }

    const result = BiRefNetMatting.extractMatting(img, 0.5, true);
    expect(result.mattedImageData.width).toBe(50);
    expect(result.hairlineFidelityScore).toBeGreaterThan(80);
    expect(result.alphaMask.length).toBe(2500);
  });
});
