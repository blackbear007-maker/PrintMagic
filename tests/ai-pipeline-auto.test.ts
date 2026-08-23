import { describe, it, expect } from 'vitest';
import { NimaAssessor } from '../src/core/nima-assessor';
import { DeshadowEngine } from '../src/core/deshadow-engine';
import { LamaInpainter } from '../src/core/lama-inpainter';
import { DEFAULT_PIPELINE_OPTIONS } from '../src/types';
import { PantoneMatcher } from '../src/core/pantone-matcher';
import { BarcodeVerifier } from '../src/core/barcode-verifier';
import { AntiBandingFilter } from '../src/core/anti-banding';

describe('Unified PyTorch AI & Automated Pre-Press Pipeline (全自動啟用驗證)', () => {
  const createMockImageData = (w: number, h: number, r = 200, g = 200, b = 200, a = 255): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('should have all 9 pre-press optimizations enabled by default in DEFAULT_PIPELINE_OPTIONS', () => {
    expect(DEFAULT_PIPELINE_OPTIONS.enableUpscale).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableSharpening).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableInkLimiting).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableShadowLift).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableBleedExpand).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableColorProofing).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableVectorOverlay).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableAntiBanding).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableDeshadow).toBe(true);
  });

  it('should evaluate image sharpness, noise, and score using NimaAssessor', () => {
    const img = createMockImageData(60, 60, 150, 150, 150);
    // Draw some high frequency edges
    for (let i = 0; i < 60; i++) {
      const idx = (i * 60 + i) * 4;
      img.data[idx] = 20;
      img.data[idx + 1] = 20;
      img.data[idx + 2] = 20;
    }

    const report = NimaAssessor.assess(img);
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(['A+', 'A', 'B', 'C']).toContain(report.grade);
    expect(report.verdict.length).toBeGreaterThan(0);
  });

  it('should normalize non-uniform illumination gradient with DeshadowEngine', () => {
    const img = createMockImageData(60, 60);
    // Create dark gradient shadow on left side
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 30; x++) {
        const idx = (y * 60 + x) * 4;
        img.data[idx] = 60; // shadow
        img.data[idx + 1] = 60;
        img.data[idx + 2] = 60;
      }
    }

    const deshadowed = DeshadowEngine.deshadow(img, 0.8);
    expect(deshadowed.width).toBe(60);
    expect(deshadowed.height).toBe(60);
    // Shadowed pixels should be brightened
    const shadowIdx = (30 * 60 + 10) * 4;
    expect(deshadowed.data[shadowIdx]).toBeGreaterThan(60);
  });

  it('should inpaint masked pixels using LamaInpainter', () => {
    const src = createMockImageData(40, 40, 200, 200, 200);
    const mask = createMockImageData(40, 40, 0, 0, 0, 0);

    // Mask center 10x10 area
    for (let y = 15; y < 25; y++) {
      for (let x = 15; x < 25; x++) {
        const idx = (y * 40 + x) * 4;
        mask.data[idx] = 255;
        mask.data[idx + 3] = 255;
      }
    }

    const inpainted = LamaInpainter.inpaint(src, mask);
    expect(inpainted.width).toBe(40);
    expect(inpainted.height).toBe(40);
  });

  it('should perform full multi-stage automated prepress pass without errors', () => {
    let img = createMockImageData(50, 50, 180, 50, 50);

    // 1. Auto Deshadow
    img = DeshadowEngine.deshadow(img, 0.7);
    expect(img).toBeDefined();

    // 2. Auto Anti-Banding
    img = AntiBandingFilter.apply(img, 0.65);
    expect(img).toBeDefined();

    // 3. Auto NIMA
    const nima = NimaAssessor.assess(img);
    expect(nima.score).toBeGreaterThan(0);

    // 4. Auto Pantone
    const pantones = PantoneMatcher.extractDominantSpotColors(img, 2);
    expect(pantones.length).toBeGreaterThan(0);

    // 5. Auto Barcode Verify
    const barcode = BarcodeVerifier.verifyImage(img, 300);
    expect(typeof barcode.isLegible).toBe('boolean');
  });
});
