import { describe, it, expect } from 'vitest';
import { PrintScoreCalculator } from '../src/core/print-score';
import { DpiCalculator } from '../src/core/dpi-calculator';
import { LanczosResizer } from '../src/engines/lanczos';
import { PRINT_PRESETS } from '../src/core/presets';

// 2026-09-25 regressions: the after-score used to count interpolated pixels as detail (a 128×192
// thumbnail went 72 → 98 on A4) and the sharpness factor could not see blur at all.

const a4 = PRINT_PRESETS['poster-a4'];

/** Deterministic "artwork" with plenty of crisp edges: random flat-colour blocks of mixed sizes. */
function blocks(w: number, h: number, seed = 7): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 235; data[i + 1] = 230; data[i + 2] = 220; data[i + 3] = 255;
  }
  const n = Math.round((w * h) / 400);
  for (let k = 0; k < n; k++) {
    const bw = 4 + Math.floor(rnd() * w * 0.08);
    const bh = 4 + Math.floor(rnd() * h * 0.08);
    const x0 = Math.floor(rnd() * (w - bw));
    const y0 = Math.floor(rnd() * (h - bh));
    const r = Math.floor(rnd() * 200), g = Math.floor(rnd() * 200), b = Math.floor(rnd() * 200);
    for (let y = y0; y < y0 + bh; y++) {
      for (let x = x0; x < x0 + bw; x++) {
        const i = (y * w + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b;
      }
    }
  }
  return new ImageData(data, w, h);
}

function boxBlur(img: ImageData, r: number): ImageData {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -r; dx <= r; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const i = (yy * w + xx) * 4;
          sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = sr / n; out[o + 1] = sg / n; out[o + 2] = sb / n; out[o + 3] = 255;
    }
  }
  return new ImageData(out, w, h);
}

function upscale(img: ImageData, scale: number): ImageData {
  const r = LanczosResizer.resize(img.data, img.width, img.height, scale);
  return new ImageData(r.data as Uint8ClampedArray<ArrayBuffer>, r.width, r.height);
}

function scoreAfterUpscale(src: ImageData, scale: number, method: 'ai' | 'interpolation', up = upscale(src, scale)) {
  const stats = PrintScoreCalculator.analyzePixels(up, { sharpnessLongSide: Math.max(src.width, src.height) });
  return PrintScoreCalculator.calculate(stats, a4, {
    upscale: { sourceWidth: src.width, sourceHeight: src.height, method }
  });
}

describe('PrintScoreCalculator — resolution is scored on detail, not interpolated pixels', () => {
  // One small source + one 4x upscale shared by the next two tests (Lanczos on big images is slow).
  const small = blocks(300, 424); // ≈ 36 DPI on A4
  const smallUp = upscale(small, 4); // 1200×1696 ≈ 145 pixel DPI

  it('caps an upscaled result at source DPI × 1.5 for interpolation', () => {
    const srcDpi = DpiCalculator.analyze(small.width, small.height, a4).currentDpi;
    const result = scoreAfterUpscale(small, 4, 'interpolation', smallUp);

    expect(result.effectiveDpi).toBe(Math.round(srcDpi * 1.5));
    expect(result.breakdown.resolution).toBeLessThan(40);
    expect(result.issues.some((t) => t.includes('補不出原圖沒有的細節'))).toBe(true);
    // Recommending yet another upscale after one was applied would be wrong advice.
    expect(result.recommendations.some((t) => t.includes('建議套用'))).toBe(false);

    // The same pixels scored without the upscale context read as their full pixel DPI, which is
    // exactly the old bug — the pipeline must pass the context.
    const naive = PrintScoreCalculator.calculate(PrintScoreCalculator.analyzePixels(smallUp), a4);
    expect(naive.effectiveDpi).toBe(DpiCalculator.analyze(smallUp.width, smallUp.height, a4).currentDpi);
    expect(naive.breakdown.resolution).toBeGreaterThan(result.breakdown.resolution + 20);
  });

  it('gives a learned (Real-ESRGAN) upscale more credit than interpolation, but not full credit', () => {
    const interp = scoreAfterUpscale(small, 4, 'interpolation', smallUp);
    const ai = scoreAfterUpscale(small, 4, 'ai', smallUp);
    expect(ai.effectiveDpi!).toBeGreaterThan(interp.effectiveDpi!);
    expect(ai.effectiveDpi!).toBeLessThan(smallUp.width / (210 / 25.4));
  });

  it('never lets an unusable thumbnail read as acceptable, before or after upscaling', () => {
    const thumb = blocks(128, 181); // ≈ 15 DPI on A4
    const before = PrintScoreCalculator.calculate(PrintScoreCalculator.analyzePixels(thumb), a4);
    const after = scoreAfterUpscale(thumb, 8, 'interpolation');
    for (const r of [before, after]) {
      expect(r.score).toBeLessThanOrEqual(60);
      expect(r.level).toBe('low');
      expect(r.verdict).toContain('解析度不足');
    }
  });

  it('keeps full-resolution artwork at the top of the scale', () => {
    const native = blocks(2480, 3508);
    const r = PrintScoreCalculator.calculate(PrintScoreCalculator.analyzePixels(native), a4);
    expect(r.effectiveDpi).toBeGreaterThanOrEqual(280);
    expect(r.breakdown.resolution).toBe(100);
    expect(r.score).toBeGreaterThanOrEqual(88);
  });

  it('has no jump at the 140 DPI severe-resolution threshold', () => {
    const stats = PrintScoreCalculator.analyzePixels(blocks(600, 848));
    const at = (dpi: number) => {
      // Pixel dimensions that land on the requested DPI for A4 portrait.
      const w = Math.round((210 / 25.4) * dpi);
      const h = Math.round((297 / 25.4) * dpi);
      return PrintScoreCalculator.calculate({ ...stats, width: w, height: h }, a4).score;
    };
    expect(Math.abs(at(141) - at(139))).toBeLessThanOrEqual(2);
    expect(at(60)).toBeLessThan(at(120));
  });
});

describe('PrintScoreCalculator — sharpness measures edge width', () => {
  it('scores crisp artwork 100 and a blurred copy clearly lower', () => {
    const crisp = blocks(800, 1131);
    const crispStats = PrintScoreCalculator.analyzePixels(crisp);
    const blurredStats = PrintScoreCalculator.analyzePixels(boxBlur(crisp, 2)); // 5×5 box

    expect(crispStats.edgeWidthPx!).toBeLessThan(1.5);
    expect(blurredStats.edgeWidthPx!).toBeGreaterThan(4);

    const crispScore = PrintScoreCalculator.calculate(crispStats, a4);
    const blurredScore = PrintScoreCalculator.calculate(blurredStats, a4);
    expect(crispScore.breakdown.sharpness).toBe(100);
    expect(blurredScore.breakdown.sharpness).toBeLessThan(80);
    expect(blurredScore.issues.some((t) => t.includes('偏模糊'))).toBe(true);
  });

  it('does not call a smooth gradient blurry — no edges means no evidence', () => {
    const w = 1200, h = 800;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = 40 + (x / w) * 180; data[i + 1] = 90; data[i + 2] = 200 - (y / h) * 120; data[i + 3] = 255;
      }
    }
    const stats = PrintScoreCalculator.analyzePixels(new ImageData(data, w, h));
    expect(stats.edgeWidthPx).toBeUndefined();
    expect(PrintScoreCalculator.calculate(stats, a4).breakdown.sharpness).toBe(100);
  });

  it('measures an upscaled result at the source scale, so the upscale itself is not scored as blur', () => {
    const src = blocks(500, 707);
    const up = upscale(src, 3);
    const atSource = PrintScoreCalculator.analyzePixels(up, { sharpnessLongSide: 707 }).edgeWidthPx!;
    const atPixels = PrintScoreCalculator.analyzePixels(up, { sharpnessLongSide: 99999 }).edgeWidthPx!;
    expect(atSource).toBeLessThan(2);
    // Capped at SHARPNESS_MEASURE_MAX_LONG_SIDE (1600 < 2121), so still wider than at source scale.
    expect(atPixels).toBeGreaterThan(atSource);
  });
});
