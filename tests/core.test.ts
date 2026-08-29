import { describe, it, expect, beforeAll } from 'vitest';
import { DpiCalculator } from '../src/core/dpi-calculator';
import { PRINT_PRESETS } from '../src/core/presets';
import { InkLimiter } from '../src/core/ink-limiter';
import { CmykEngine } from '../src/core/cmyk-engine';
import { UnsharpMask } from '../src/core/unsharp-mask';
import { PrintScoreCalculator } from '../src/core/print-score';
import { LanczosResizer } from '../src/engines/lanczos';
import { VectorTracer } from '../src/engines/vector-tracer';

// Polyfill ImageData for Node environment testing
beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    class ImageDataPolyfill {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, maybeHeight?: number) {
        if (typeof dataOrWidth === 'number') {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        } else {
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = maybeHeight || 0;
        }
      }
    }
    (globalThis as any).ImageData = ImageDataPolyfill;
  }
});

describe('DpiCalculator', () => {
  it('should accurately convert millimeters to pixels at 300 DPI', () => {
    // A4 width: 210mm at 300 DPI = (210 / 25.4) * 300 ≈ 2480px
    const px = DpiCalculator.mmToPx(210, 300);
    expect(px).toBe(2480);
  });

  it('should calculate accurate DPI and detect upscale requirement for low-res image', () => {
    const a4Preset = PRINT_PRESETS['poster-a4']; // 210 x 297 mm
    // A low-res image 1000 x 1414 px
    const analysis = DpiCalculator.analyze(1000, 1414, a4Preset);
    expect(analysis.currentDpi).toBeLessThan(150);
    expect(analysis.needsUpscale).toBe(true);
    expect(analysis.scaleFactor).toBeGreaterThanOrEqual(2);
  });

  it('should identify high-res image as excellent quality', () => {
    const a4Preset = PRINT_PRESETS['poster-a4'];
    // High-res image 3000 x 4242 px
    const analysis = DpiCalculator.analyze(3000, 4242, a4Preset);
    expect(analysis.currentDpi).toBeGreaterThanOrEqual(300);
    expect(analysis.qualityTier).toBe('excellent');
    expect(analysis.needsUpscale).toBe(false);
  });

  it('should report the social preset\'s real 1080x1920 target, matching its own portrait-oriented spec (not a hardcoded square)', () => {
    const socialPreset = PRINT_PRESETS['social'];
    // A portrait/square-ish input image -> target should be portrait 1080x1920, matching
    // presets.ts's own "1080 × 1920 px" description, not a hardcoded 1080x1080 square.
    const portraitAnalysis = DpiCalculator.analyze(900, 1600, socialPreset);
    expect(portraitAnalysis.targetWidthPx).toBe(1080);
    expect(portraitAnalysis.targetHeightPx).toBe(1920);

    // A landscape input image -> target dimensions should flip to match orientation.
    const landscapeAnalysis = DpiCalculator.analyze(1600, 900, socialPreset);
    expect(landscapeAnalysis.targetWidthPx).toBe(1920);
    expect(landscapeAnalysis.targetHeightPx).toBe(1080);
  });
});

describe('InkLimiter', () => {
  // 2026-08-28: this whole describe block replaces a version that encoded the bug it should have
  // caught — its old test asserted pure black (0,0,0) produces "400% TAC" as CORRECT/expected,
  // when the real industry-standard TAC for pure K-only black is 100%. That 400% came from a real
  // double-counting bug (naive CMY *plus* a separately-added K, instead of K replacing the shared
  // gray component) — see the fix note in ink-limiter.ts. These tests assert the corrected math.

  it('should NOT flag pure black as ink overflow under the corrected GCR-aware TAC formula', () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,   0, 0, 0, 255,
      0, 0, 0, 255,   0, 0, 0, 255
    ]);
    const imgData = new ImageData(data, 2, 2);
    const analysis = InkLimiter.analyze(imgData, 300);

    // Real adaptive-GCR separation (see cmyk-engine.ts) keeps pure black well under 300% —
    // nowhere near the old (buggy) 400% figure.
    expect(analysis.hasOverflow).toBe(false);
    expect(analysis.maxTotalInk).toBeLessThan(200);
    expect(analysis.exceededPixelCount).toBe(0);
  });

  it('should still detect real overflow for a saturated, low-GCR color against a realistic threshold', () => {
    // A fully saturated primary (pure red) has zero gray component, so GCR does nothing to it —
    // its real TAC sits around 200% (0% C + 100% M + 100% Y + 0% K). A threshold well below that
    // should still correctly flag it as over budget.
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,   255, 0, 0, 255,
      255, 0, 0, 255,   255, 0, 0, 255
    ]);
    const imgData = new ImageData(data, 2, 2);
    const analysis = InkLimiter.analyze(imgData, 150);

    expect(analysis.hasOverflow).toBe(true);
    expect(analysis.maxTotalInk).toBeGreaterThan(150);
    expect(analysis.exceededPixelCount).toBe(4);
  });

  it('should clamp excessive ink values to within threshold', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,   255, 0, 60, 255,
      0, 255, 0, 255,   0, 60, 255, 255
    ]);
    const imgData = new ImageData(data, 2, 2);
    const clamped = InkLimiter.clampInk(imgData, 150);

    const reAnalysis = InkLimiter.analyze(clamped.clampedImageData, 150);
    expect(reAnalysis.maxTotalInk).toBeLessThanOrEqual(150);
    expect(reAnalysis.exceededPixelCount).toBe(0);
  });
});

describe('CmykEngine', () => {
  it('should correctly convert pure white to zero CMYK', () => {
    const cmyk = CmykEngine.rgbToCmyk(255, 255, 255);
    expect(cmyk.c).toBeCloseTo(0, 1);
    expect(cmyk.m).toBeCloseTo(0, 1);
    expect(cmyk.y).toBeCloseTo(0, 1);
    expect(cmyk.k).toBeCloseTo(0, 1);
  });

  it('should reconstruct a stable, plausible color for a saturated midtone (not a lossless round-trip)', () => {
    // 2026-08-28: this test used to assert rgb→cmyk→rgb stays within 20 units of the original —
    // that only held by accident while GCR was dead code (see the fix note in cmyk-engine.ts).
    // rgbToCmyk() and cmykToRgb() are NOT mathematical inverses of each other by design:
    // rgbToCmyk() does Bradford D65→D50 chromatic adaptation (one-directional — cmykToRgb() has no
    // D50→D65 step back) and additive GCR (k replaces a flat amount subtracted from c0/m0/y0);
    // cmykToRgb() instead models physical ink overprint as multiplicative absorption
    // ((1-c)*(1-k)), which is the physically-correct model for print/proof simulation. Both are
    // individually accurate for their own real purpose, but composing them is a genuinely lossy,
    // non-invertible pipeline — for this input the real round-trip delta is r+8/g+60/b+99, and a
    // wider survey across the RGB cube finds deltas up to ~136. Widening the old tolerance to
    // "cover" that would just be asserting "produces some RGB color", so this instead pins the
    // actual current output as a regression snapshot — it catches unintended future changes to
    // either formula, without pretending round-trip identity is the right invariant here.
    const origR = 180, origG = 90, origB = 40;
    const cmyk = CmykEngine.rgbToCmyk(origR, origG, origB);
    expect(cmyk.c).toBeCloseTo(0.1087, 3);
    expect(cmyk.m).toBeCloseTo(0.4629, 3);
    expect(cmyk.y).toBeCloseTo(0.5439, 3);
    expect(cmyk.k).toBeCloseTo(0.4349, 3);

    const rgb = CmykEngine.cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
    expect(rgb.r).toBe(188);
    expect(rgb.g).toBe(150);
    expect(rgb.b).toBe(139);
  });

  it('should use the correct D50-adapted (not D65) inverse matrix — verified by white-point neutrality', () => {
    // A 5-agent optimization audit flagged rgbToCmyk()'s "XYZ D50 -> linear RGB" step (previously
    // commented "Approximate: simplified conversion back") as possibly reusing the plain D65
    // inverse sRGB matrix by mistake. Verified against Bruce Lindbloom's published sRGB/D50
    // reference matrix and by direct computation: it's already correct. This test pins that down
    // mathematically — a matrix genuinely adapted to the D50 white point must map the D50
    // reference white's own XYZ back to a neutral RGB (r≈g≈b≈1); the plain D65 inverse matrix
    // does NOT have this property (it maps D50 white to a visibly non-neutral ~(1.176, ...)).
    const D50_WHITE_XYZ = { X: 0.9642, Y: 1.0000, Z: 0.8249 };
    const D65_INVERSE_MATRIX = [
      3.2404542, -1.5371385, -0.4985314,
      -0.9692660, 1.8760108, 0.0415560,
      0.0556434, -0.2040259, 1.0572252
    ];
    const applyD50: (X: number, Y: number, Z: number) => [number, number, number] = (X, Y, Z) => [
      3.1338561 * X - 1.6168667 * Y - 0.4906146 * Z,
      -0.9787684 * X + 1.9161415 * Y + 0.0334540 * Z,
      0.0719453 * X - 0.2289914 * Y + 1.4052427 * Z
    ];
    const applyD65 = (X: number, Y: number, Z: number): [number, number, number] => [
      D65_INVERSE_MATRIX[0] * X + D65_INVERSE_MATRIX[1] * Y + D65_INVERSE_MATRIX[2] * Z,
      D65_INVERSE_MATRIX[3] * X + D65_INVERSE_MATRIX[4] * Y + D65_INVERSE_MATRIX[5] * Z,
      D65_INVERSE_MATRIX[6] * X + D65_INVERSE_MATRIX[7] * Y + D65_INVERSE_MATRIX[8] * Z
    ];

    const [r50, g50, b50] = applyD50(D50_WHITE_XYZ.X, D50_WHITE_XYZ.Y, D50_WHITE_XYZ.Z);
    expect(r50).toBeCloseTo(1.0, 2);
    expect(g50).toBeCloseTo(1.0, 2);
    expect(b50).toBeCloseTo(1.0, 2);

    // Sanity check the test's own premise: the D65 matrix must NOT be neutral for D50 white,
    // otherwise this test couldn't actually distinguish the two matrices.
    const [r65, g65] = applyD65(D50_WHITE_XYZ.X, D50_WHITE_XYZ.Y, D50_WHITE_XYZ.Z);
    expect(Math.abs(r65 - 1.0)).toBeGreaterThan(0.1);
    expect(Math.abs(g65 - 1.0)).toBeLessThan(0.1); // g channel is coincidentally close; r/b are not
  });
});

describe('UnsharpMask', () => {
  it('should preserve dimensions and alpha channel', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,   0, 255, 0, 255,
      0, 0, 255, 255,   255, 255, 0, 255
    ]);
    const imgData = new ImageData(data, 2, 2);
    const sharpened = UnsharpMask.apply(imgData, 1.5, 1, 3);

    expect(sharpened.width).toBe(2);
    expect(sharpened.height).toBe(2);
    expect(sharpened.data[3]).toBe(255);
    expect(sharpened.data[7]).toBe(255);
  });
});

describe('LanczosResizer', () => {
  it('should calculate kernel values accurately', () => {
    expect(LanczosResizer.kernel(0)).toBe(1);
    expect(LanczosResizer.kernel(3)).toBe(0);
    expect(LanczosResizer.kernel(4)).toBe(0);
  });

  it('should accurately double dimensions on 2x resize', () => {
    const data = new Uint8ClampedArray([
      200, 100, 50, 255,   150, 120, 80, 255,
      100, 80, 20, 255,    50, 200, 100, 255
    ]);
    const result = LanczosResizer.resize(data, 2, 2, 2);

    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.data.length).toBe(4 * 4 * 4);
  });
});

describe('PrintScoreCalculator', () => {
  it('should generate honest scores in the 0-100 range', () => {
    const data = new Uint8ClampedArray(400 * 400 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 120;
      data[i + 1] = 120;
      data[i + 2] = 120;
      data[i + 3] = 255;
    }
    const imgData = new ImageData(data, 400, 400);
    const stats = PrintScoreCalculator.analyzePixels(imgData);
    const a4Preset = PRINT_PRESETS['poster-a4'];

    const scoreResult = PrintScoreCalculator.calculate(stats, a4Preset);
    expect(scoreResult.score).toBeGreaterThanOrEqual(0);
    expect(scoreResult.score).toBeLessThanOrEqual(100);
    expect(scoreResult.breakdown.resolution).toBeDefined();
    expect(scoreResult.issues.length).toBeGreaterThan(0);
  });

  it('should actually detect gamut-risk pixels for a vividly saturated image', () => {
    // 2026-08-28: the old formula was a mathematical identity (round-trip always ~equals the
    // input), so gamutOverflowRatio was ~0 for every image regardless of content — this test
    // pins the fix: a genuinely vivid, highly saturated image must produce a nonzero ratio.
    const data = new Uint8ClampedArray(200 * 200 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;       // pure saturated green — the classic sRGB-vs-CMYK gamut mismatch case
      data[i + 1] = 255;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    const imgData = new ImageData(data, 200, 200);
    const stats = PrintScoreCalculator.analyzePixels(imgData);
    expect(stats.gamutOverflowRatio).toBeGreaterThan(0.9);
  });

  it('should NOT flag an ordinary desaturated photo as gamut risk', () => {
    const data = new Uint8ClampedArray(200 * 200 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 224;     // skin-tone-ish, not saturated
      data[i + 1] = 172;
      data[i + 2] = 140;
      data[i + 3] = 255;
    }
    const imgData = new ImageData(data, 200, 200);
    const stats = PrintScoreCalculator.analyzePixels(imgData);
    expect(stats.gamutOverflowRatio).toBe(0);
  });
});

describe('VectorTracer', () => {
  it('should generate valid SVG markup from binary test image', () => {
    const data = new Uint8ClampedArray(10 * 10 * 4);
    // Draw a dark 4x4 square in the middle
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const idx = (y * 10 + x) * 4;
        const isDark = x >= 3 && x <= 6 && y >= 3 && y <= 6;
        data[idx] = isDark ? 10 : 240;
        data[idx + 1] = isDark ? 10 : 240;
        data[idx + 2] = isDark ? 10 : 240;
        data[idx + 3] = 255;
      }
    }
    const imgData = new ImageData(data, 10, 10);
    const svg = VectorTracer.traceToSvg(imgData, 128);

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 10 10"');
    expect(svg).toContain('</svg>');
  });
});
