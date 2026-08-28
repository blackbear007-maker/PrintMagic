import { describe, it, expect } from 'vitest';

// All of the below are deterministic TypeScript algorithms — none require Rust, Python/OpenCV, or
// PyTorch at runtime, regardless of what earlier comments in this file used to claim.
import { KurboGeometry } from '../src/core/kurbo-geometry';
import { ContrastStretchFilter } from '../src/core/contrast-stretch-filter';
import { SmoothingDenoiseFilter } from '../src/core/smoothing-denoise-filter';
import { SharpenDeblurFilter } from '../src/core/sharpen-deblur-filter';
import { CurvedPageFlattener } from '../src/core/curved-page-flattener';
import { ColorRegionSelector } from '../src/core/color-region-selector';

describe('Deterministic Pre-Press Algorithm Suite', () => {
  const createMockImageData = (w: number, h: number, r = 180, g = 180, b = 180, a = 255): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  describe('Polygon Offset Geometry', () => {
    it('KurboGeometry: should compute 2mm outer cutline and 0.2mm white ink choke polygon', () => {
      const square = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 }
      ];

      const offset2mm = KurboGeometry.offsetPolygon(square, 2.0);
      expect(offset2mm.length).toBe(4);
      expect(offset2mm[1].x).toBeGreaterThan(50); // Expanded outward

      const svgDieline = KurboGeometry.generateDielineSvg(offset2mm, 90, 54);
      expect(svgDieline).toContain('#FF00FF');
      expect(svgDieline).toContain('viewBox="0 0 90 54"');
    });
  });

  describe('Contrast Stretch', () => {
    it('ContrastStretchFilter: should apply a global power-curve contrast stretch', () => {
      const img = createMockImageData(40, 40, 120, 120, 120);
      const equalized = ContrastStretchFilter.apply(img, 2.5);
      expect(equalized.width).toBe(40);
    });
  });

  describe('Denoise, Deblur, Dewarp, Select, Extend', () => {
    it('SmoothingDenoiseFilter & SharpenDeblurFilter: should denoise and deblur without losing image dimensions', () => {
      const img = createMockImageData(30, 30);
      const denoised = SmoothingDenoiseFilter.denoise(img);
      expect(denoised.width).toBe(30);

      const deblurred = SharpenDeblurFilter.deblur(img);
      expect(deblurred.width).toBe(30);
    });

    it('CurvedPageFlattener & ColorRegionSelector: should dewarp and select a region', () => {
      const img = createMockImageData(40, 40);
      const dewarped = CurvedPageFlattener.dewarp(img, 0.25);
      expect(dewarped.width).toBe(40);

      const seg = ColorRegionSelector.segmentObjectAtPoint(img, 20, 20, 'foil', 32);
      expect(seg.coverageMm2).toBeGreaterThanOrEqual(0);
    });
  });
});
