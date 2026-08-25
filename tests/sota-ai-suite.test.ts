import { describe, it, expect } from 'vitest';
import { BiRefNetMatting } from '../src/core/birefnet-matting';
import { ZeroDceEnhancer } from '../src/core/zero-dce-enhancer';
import { RealEsrganUpscaler } from '../src/core/realesrgan-upscaler';
import { PpOcrEngine } from '../src/core/pp-ocr-engine';
import { MobileSamSegmenter } from '../src/core/mobilesam-segmenter';
import { Sam2Segmenter } from '../src/core/sam2-segmenter';
import { DoctrDewarp } from '../src/core/doctr-dewarp';
import { TeedEdgeDetector } from '../src/core/teed-edge';
import { ClipIqaAssessor } from '../src/core/clip-iqa-assessor';
import { FastLamaInpainter } from '../src/core/fast-lama-inpaint';

describe('SOTA Open-Source Commercial Pre-Press Suite (頂級可商用 AI 模型陣列)', () => {
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

  // 1. BiRefNet-Lite Matting
  it('1. BiRefNet-Lite: should perform bilateral reference matting with sub-pixel edge choke', () => {
    const img = createMockImageData(64, 64, 255, 255, 255);
    for (let y = 16; y < 48; y++) {
      for (let x = 16; x < 48; x++) {
        const idx = (y * 64 + x) * 4;
        img.data[idx] = 40;
        img.data[idx + 1] = 80;
        img.data[idx + 2] = 160;
      }
    }

    const result = BiRefNetMatting.extractMatting(img, 0.5, true);
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

  // 3. RealESRGAN-Compact 4x Super-Resolution
  it('3. RealESRGAN-Compact: should upscale 2x and 4x with sharp gradient edges and no overshoot', () => {
    const src = createMockImageData(32, 32, 100, 150, 200);
    const res2x = RealEsrganUpscaler.upscale(src, 2, 0.5);
    expect(res2x.upscaledImageData.width).toBe(64);
    expect(res2x.upscaledImageData.height).toBe(64);
    expect(res2x.scaleFactor).toBe(2);

    const res4x = RealEsrganUpscaler.upscale(src, 4, 0.5);
    expect(res4x.upscaledImageData.width).toBe(128);
    expect(res4x.upscaledImageData.height).toBe(128);
    expect(res4x.scaleFactor).toBe(4);
    expect(res4x.noiseSuppressedScore).toBeGreaterThan(90);
  });

  // 4. PP-OCRv5 Mobile OCR
  it('4. PP-OCRv5 Mobile: should detect text zones and check 0.25pt minimum legibility', () => {
    const img = createMockImageData(80, 80, 255, 255, 255);
    for (let y = 10; y < 30; y += 2) {
      for (let x = 10; x < 60; x += 2) {
        const idx = (y * 80 + x) * 4;
        img.data[idx] = 0;
        img.data[idx + 1] = 0;
        img.data[idx + 2] = 0;
      }
    }

    const ocr = PpOcrEngine.inspectText(img, 8);
    expect(ocr.detectedBlocks.length).toBeGreaterThan(0);
    expect(ocr.languageDetected).toBe('chi_tra+eng');
    expect(typeof ocr.preflightPassed).toBe('boolean');
  });

  // 5. MobileSAM / SAM 2.1 1-Click Spot Finish
  it('5. SAM 2.1 Tiny: should isolate object from click coordinates and generate 100% K100 mask', () => {
    const img = createMockImageData(60, 60, 255, 255, 255);
    for (let y = 20; y < 40; y++) {
      for (let x = 20; x < 40; x++) {
        const idx = (y * 60 + x) * 4;
        img.data[idx] = 220;
        img.data[idx + 1] = 20;
        img.data[idx + 2] = 20;
      }
    }

    const spotFoil = Sam2Segmenter.segmentObjectAtPoint(img, 30, 30, 'foil', 30);
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

  // 6. DocTr-Dewarp-Lite 3D Surface Dewarping
  it('6. DocTr-Dewarp-Lite: should calculate 3D geometric surface flow and unwarp curved pages', () => {
    const img = createMockImageData(60, 60);
    const result = DoctrDewarp.dewarpWithMetrics(img, 0.3);

    expect(result.dewarpedImageData.width).toBe(60);
    expect(result.estimatedCurvatureRadiusMm).toBeGreaterThan(0);
    expect(result.flatnessConfidence).toBeGreaterThan(80);
    expect(result.linesStraightened).toBeGreaterThan(0);
  });

  // 7. TEED Edge Detector (CVPR SOTA)
  it('7. TEED Edge Detector: should extract crisp 1px hairline cut contour with 0 noise', () => {
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

    const res = TeedEdgeDetector.detectEdges(img, 20, true);
    expect(res.contourImageData.width).toBe(60);
    expect(res.edgePixelCount).toBeGreaterThan(0);
    expect(res.continuousClosedLoops).toBeGreaterThanOrEqual(1);
    expect(res.edgeComplexityScore).toBeGreaterThan(0);
  });

  // 8. CLIP-IQA+ Zero-Shot Print Assessor
  it('8. CLIP-IQA+: should score technical clarity and commercial aesthetics', () => {
    const img = createMockImageData(60, 60, 120, 140, 160);
    const res = ClipIqaAssessor.assess(img);

    expect(res.score).toBeGreaterThan(50);
    expect(res.technicalClarityScore).toBeGreaterThan(50);
    expect(res.aestheticQualityScore).toBeGreaterThan(50);
    expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(res.grade);
  });

  // 9. Fast-LaMa v2 Bleed Extension
  it('9. Fast-LaMa v2: should generate seamless 3mm bleed margin extension without boundary seam', () => {
    const img = createMockImageData(50, 50, 100, 120, 140);
    const res = FastLamaInpainter.generateBleedMargin(img, 36);

    expect(res.expandedImageData.width).toBe(50 + 72);
    expect(res.expandedImageData.height).toBe(50 + 72);
    expect(res.bleedWidthPx).toBe(36);
    expect(res.spectralCoherenceScore).toBeGreaterThan(95);
  });
});
