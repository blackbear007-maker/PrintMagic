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
});

describe('InkLimiter', () => {
  it('should detect extreme ink overflow on solid black/rich black', () => {
    // 2x2 solid black pixels (RGB 0,0,0) -> CMYK (100, 100, 100, 100) -> 400% TAC
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,   0, 0, 0, 255,
      0, 0, 0, 255,   0, 0, 0, 255
    ]);
    const imgData = new ImageData(data, 2, 2);
    const analysis = InkLimiter.analyze(imgData, 300);

    expect(analysis.hasOverflow).toBe(true);
    expect(analysis.maxTotalInk).toBeGreaterThan(300);
    expect(analysis.exceededPixelCount).toBe(4);
  });

  it('should clamp excessive ink values to within threshold', () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,   10, 10, 10, 255,
      0, 0, 0, 255,   20, 20, 20, 255
    ]);
    const imgData = new ImageData(data, 2, 2);
    const clamped = InkLimiter.clampInk(imgData, 300);

    const reAnalysis = InkLimiter.analyze(clamped.clampedImageData, 300);
    expect(reAnalysis.maxTotalInk).toBeLessThanOrEqual(300);
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

  it('should perform round-trip conversion without severe delta', () => {
    const origR = 180, origG = 90, origB = 40;
    const cmyk = CmykEngine.rgbToCmyk(origR, origG, origB);
    const rgb = CmykEngine.cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);

    expect(Math.abs(rgb.r - origR)).toBeLessThan(20);
    expect(Math.abs(rgb.g - origG)).toBeLessThan(20);
    expect(Math.abs(rgb.b - origB)).toBeLessThan(20);
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
