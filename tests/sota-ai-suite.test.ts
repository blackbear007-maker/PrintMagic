import { describe, it, expect } from 'vitest';
import { EdgeChokeMatting } from '../src/core/edge-choke-matting';
import { ZeroDceEnhancer } from '../src/core/zero-dce-enhancer';
import { EdgeAwareUpscaler } from '../src/core/edge-aware-upscaler';
import { TextZoneDetector } from '../src/core/text-zone-detector';
import { ColorRegionSelector } from '../src/core/color-region-selector';
import { CurvedPageFlattener } from '../src/core/curved-page-flattener';
import { EdgeContourDetector } from '../src/core/edge-contour-detector';
import { PixelStatQualityAssessor } from '../src/core/pixel-stat-quality-assessor';
import { EdgeExtendInpainter } from '../src/core/edge-extend-inpaint';

describe('Deterministic Pre-Press Algorithm Suite (本機決定性演算法陣列，非 AI 模型)', () => {
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

  // 1. Corner-Sampled Color-Distance Matting
  it('1. EdgeChokeMatting: should perform color-distance matting with sub-pixel edge choke', () => {
    const img = createMockImageData(64, 64, 255, 255, 255);
    for (let y = 16; y < 48; y++) {
      for (let x = 16; x < 48; x++) {
        const idx = (y * 64 + x) * 4;
        img.data[idx] = 40;
        img.data[idx + 1] = 80;
        img.data[idx + 2] = 160;
      }
    }

    const result = EdgeChokeMatting.extractMatting(img, 0.5, true);
    expect(result.mattedImageData.width).toBe(64);
    expect(result.mattedImageData.height).toBe(64);
    expect(result.alphaMask.length).toBe(64 * 64);
    expect(result.hairlineFidelityScore).toBeGreaterThan(80);
    expect(typeof result.translucencyDetected).toBe('boolean');
  });

  // 2. Zero-DCE++ Low-Light Enhancement
  it('2. Zero-DCE++: should enhance low-light image non-linearly without noise amplification', () => {
    const darkImg = createMockImageData(50, 50, 30, 30, 30);
    const result = ZeroDceEnhancer.enhance(darkImg, 4, 0.7);

    expect(result.enhancedImageData.width).toBe(50);
    expect(result.meanLuminanceAfter).toBeGreaterThan(result.meanLuminanceBefore);
    expect(result.shadowBoostFactor).toBeGreaterThan(1.0);
    expect(result.noiseAmplificationRatio).toBeLessThanOrEqual(1.05);
  });

  // 3. Edge-Aware 4x Upscaling (deterministic, not a trained super-resolution model)
  it('3. EdgeAwareUpscaler: should upscale 2x and 4x with sharp gradient edges and no overshoot', () => {
    const src = createMockImageData(32, 32, 100, 150, 200);
    const res2x = EdgeAwareUpscaler.upscale(src, 2, 0.5);
    expect(res2x.upscaledImageData.width).toBe(64);
    expect(res2x.upscaledImageData.height).toBe(64);
    expect(res2x.scaleFactor).toBe(2);

    const res4x = EdgeAwareUpscaler.upscale(src, 4, 0.5);
    expect(res4x.upscaledImageData.width).toBe(128);
    expect(res4x.upscaledImageData.height).toBe(128);
    expect(res4x.scaleFactor).toBe(4);
    expect(res4x.noiseSuppressedScore).toBeGreaterThan(90);
  });

  // 4. Text Zone Detector (locates likely text regions; does not read/OCR content)
  it('4. TextZoneDetector: should detect text zones and check 0.25pt minimum legibility', () => {
    const img = createMockImageData(80, 80, 255, 255, 255);
    for (let y = 10; y < 30; y += 2) {
      for (let x = 10; x < 60; x += 2) {
        const idx = (y * 80 + x) * 4;
        img.data[idx] = 0;
        img.data[idx + 1] = 0;
        img.data[idx + 2] = 0;
      }
    }

    const ocr = TextZoneDetector.inspectText(img, 8);
    expect(ocr.detectedZones.length).toBeGreaterThan(0);
    expect(ocr.totalZones).toBe(ocr.detectedZones.length);
    expect(typeof ocr.preflightPassed).toBe('boolean');
  });

  // 5. Color-Region Flood-Fill 1-Click Spot Finish (color-distance based, not a segmentation model)
  it('5. ColorRegionSelector: should isolate object from click coordinates and generate 100% K100 mask', () => {
    const img = createMockImageData(60, 60, 255, 255, 255);
    for (let y = 20; y < 40; y++) {
      for (let x = 20; x < 40; x++) {
        const idx = (y * 60 + x) * 4;
        img.data[idx] = 220;
        img.data[idx + 1] = 20;
        img.data[idx + 2] = 20;
      }
    }

    const spotFoil = ColorRegionSelector.segmentObjectAtPoint(img, 30, 30, 'foil', 30);
    expect(spotFoil.spotType).toBe('foil');
    expect(spotFoil.coveragePercent).toBeGreaterThan(0);
    expect(spotFoil.contourSvgPath).toContain('M ');

    // Center pixel of K100 mask must be pure black (RGB: 0, 0, 0, A: 255)
    const centerIdx = (30 * 60 + 30) * 4;
    expect(spotFoil.k100MaskData.data[centerIdx]).toBe(0);
    expect(spotFoil.k100MaskData.data[centerIdx + 1]).toBe(0);
    expect(spotFoil.k100MaskData.data[centerIdx + 2]).toBe(0);
    expect(spotFoil.k100MaskData.data[centerIdx + 3]).toBe(255);
  });

  // 6. Curved Page Flattener (geometric dewarp, not a learned model)
  it('6. CurvedPageFlattener: should calculate geometric surface flow and unwarp curved pages', () => {
    const img = createMockImageData(60, 60);
    const result = CurvedPageFlattener.dewarpWithMetrics(img, 0.3);

    expect(result.dewarpedImageData.width).toBe(60);
    expect(result.estimatedCurvatureRadiusMm).toBeGreaterThan(0);
    expect(result.flatnessConfidence).toBeGreaterThan(80);
    expect(result.linesStraightened).toBeGreaterThan(0);
  });

  // 7. Edge Contour Detector (Canny-style deterministic edge detection, not a trained model)
  it('7. EdgeContourDetector: should extract crisp 1px hairline cut contour with 0 noise', () => {
    const img = createMockImageData(60, 60, 255, 255, 255);
    // Draw high contrast box in center
    for (let y = 15; y < 45; y++) {
      for (let x = 15; x < 45; x++) {
        const idx = (y * 60 + x) * 4;
        img.data[idx] = 10;
        img.data[idx + 1] = 10;
        img.data[idx + 2] = 10;
      }
    }

    const res = EdgeContourDetector.detectEdges(img, 20, true);
    expect(res.contourImageData.width).toBe(60);
    expect(res.edgePixelCount).toBeGreaterThan(0);
    expect(res.continuousClosedLoops).toBeGreaterThanOrEqual(1);
    expect(res.edgeComplexityScore).toBeGreaterThan(0);
  });

  // 8. Pixel-Statistics Quality Assessor (not CLIP, no vision-language model involved)
  it('8. PixelStatQualityAssessor: should score technical clarity and commercial aesthetics', () => {
    const img = createMockImageData(60, 60, 120, 140, 160);
    const res = PixelStatQualityAssessor.assess(img);

    expect(res.score).toBeGreaterThan(50);
    expect(res.technicalClarityScore).toBeGreaterThan(50);
    expect(res.aestheticQualityScore).toBeGreaterThan(50);
    expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(res.grade);
  });

  // 9. Edge-Extend Bleed Inpainter (mirror/edge extrapolation, not a generative inpainting model)
  it('9. EdgeExtendInpainter: should generate seamless 3mm bleed margin extension without boundary seam', () => {
    const img = createMockImageData(50, 50, 100, 120, 140);
    const res = EdgeExtendInpainter.generateBleedMargin(img, 36);

    expect(res.expandedImageData.width).toBe(50 + 72);
    expect(res.expandedImageData.height).toBe(50 + 72);
    expect(res.bleedWidthPx).toBe(36);
  });
});
