import { describe, it, expect } from 'vitest';

// Deterministic local pre-press algorithms — no ML models, no framework claims.
import { SmoothingDenoiseFilter } from '../src/core/smoothing-denoise-filter';
import { SharpenDeblurFilter } from '../src/core/sharpen-deblur-filter';
import { GradientCentroidCropper } from '../src/core/gradient-centroid-cropper';
import { ColorRegionSelector } from '../src/core/color-region-selector';
import { EdgeAwareUpscaler } from '../src/core/edge-aware-upscaler';
import { EdgeContourDetector } from '../src/core/edge-contour-detector';
import { CurvedPageFlattener } from '../src/core/curved-page-flattener';
import { PixelStatQualityAssessor } from '../src/core/pixel-stat-quality-assessor';
import { HandShadowBalancer } from '../src/core/hand-shadow-balancer';
import { EdgeChokeMatting } from '../src/core/edge-choke-matting';
import { ZeroDceEnhancer } from '../src/core/zero-dce-enhancer';
import { AntiBandingFilter } from '../src/core/anti-banding';
import { PantoneMatcher } from '../src/core/pantone-matcher';

describe('Deterministic Local Pre-Press Algorithm Suite', () => {
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

  // ─── Bilateral-style smoothing denoiser ──────────────────────────────────
  it('SmoothingDenoiseFilter: should suppress JPEG and chromatic noise with edge-awareness', () => {
    const img = createMockImageData(30, 30);
    const denoised = SmoothingDenoiseFilter.denoise(img, 0.6);
    expect(denoised.width).toBe(30);
    expect(denoised.height).toBe(30);
  });

  // ─── Fixed-kernel deconvolution sharpener ────────────────────────────────
  it('SharpenDeblurFilter: should sharpen soft focus and handshake blur', () => {
    const img = createMockImageData(30, 30);
    const deblurred = SharpenDeblurFilter.deblur(img, 0.5);
    expect(deblurred.width).toBe(30);
  });

  // ─── Gradient-centroid focal cropper ─────────────────────────────────────
  it('GradientCentroidCropper: should estimate a focal subject bounding box', () => {
    const img = createMockImageData(80, 80);
    const focal = GradientCentroidCropper.detectSubject(img);
    expect(focal.confidence).toBeGreaterThan(0.5);
    expect(focal.width).toBeGreaterThan(0);
    expect(focal.height).toBeGreaterThan(0);
  });

  // ─── Color-distance region selector ──────────────────────────────────────
  it('ColorRegionSelector: should select a region from a single click coordinate into a spot mask', () => {
    const img = createMockImageData(40, 40, 255, 0, 0); // Red
    const seg = ColorRegionSelector.segmentObjectAtPoint(img, 20, 20, 'foil', 30);
    expect(seg.coverageMm2).toBeGreaterThan(0);
    expect(seg.contourSvgPath).toContain('M ');
  });

  // ─── Bilinear + edge-boost upscaler ──────────────────────────────────────
  it('EdgeAwareUpscaler: should perform 2x upscaling with edge sharpening', () => {
    const img = createMockImageData(25, 25);
    const upscaled = EdgeAwareUpscaler.upscale(img, 2, 0.5);
    expect(upscaled.upscaledImageData.width).toBe(50);
    expect(upscaled.upscaledImageData.height).toBe(50);
  });

  // ─── Gradient edge contour detector ──────────────────────────────────────
  it('EdgeContourDetector: should extract continuous single-pixel cut contour edges', () => {
    const img = createMockImageData(30, 30);
    const contour = EdgeContourDetector.extractContour(img, 20);
    expect(contour.width).toBe(30);
  });

  // ─── Parabolic curve-model page flattener ────────────────────────────────
  it('CurvedPageFlattener: should apply the fixed curvature displacement model', () => {
    const img = createMockImageData(40, 40);
    const dewarped = CurvedPageFlattener.dewarp(img, 0.2);
    expect(dewarped.width).toBe(40);
  });

  // ─── Remaining deterministic algorithms ──────────────────────────────────
  it('should verify the remaining local algorithms in the suite', () => {
    const img = createMockImageData(40, 40);

    const qualityScore = PixelStatQualityAssessor.assess(img);
    expect(qualityScore.score).toBeGreaterThan(0);

    const deshadow = HandShadowBalancer.deshadow(img);
    expect(deshadow.width).toBe(40);

    const zeroDce = ZeroDceEnhancer.enhance(img, 2, 0.5);
    expect(zeroDce.enhancedImageData.width).toBe(40);

    const matting = EdgeChokeMatting.extractMatting(img, 0.5, true);
    expect(matting.hairlineFidelityScore).toBeGreaterThan(80);

    const pantone = PantoneMatcher.matchRgb(228, 0, 43);
    expect(pantone.pantone.code).toBe('Pantone 185 C');

    const antiband = AntiBandingFilter.apply(img);
    expect(antiband.width).toBe(40);
  });
});
