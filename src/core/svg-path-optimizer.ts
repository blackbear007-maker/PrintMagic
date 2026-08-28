/**
 * ⚡ SVG Path Optimizer & Dieline Compressor
 *
 * A real, working hand-rolled optimizer — not SVGO or svgcleaner (no plugin pipeline, no path
 * re-parsing/curve simplification beyond what's listed below; "SVGO / svgcleaner logic" overstated
 * what this is).
 *
 * Pre-Press Problem Solved:
 * VTracer and auto-vectorizers produce raw SVGs with millions of dense points and 8-decimal precision.
 * Commercial Roland / Graphtec / Mimaki laser cutting plotters stall or stutter when processing bloated paths.
 *
 * Solution:
 * 1. Decimal Precision Clamping (e.g. 124.54923184 ➔ 124.5)
 * 2. XML comment/doctype stripping and redundant-whitespace trimming.
 *
 * ⚠️ 2026-08-28 誠實澄清：文檔曾經還宣稱做「共線與重複節點移除」跟「指令合併」（例如
 * `L 10 10 L 20 20` 合併成 `L 10 10 20 20`），但 `optimizePathData()` 完全沒有實作這兩項——只做
 * 精度裁切跟空白清理。對應的 `pathNodesRemoved` 統計欄位也從未真正被計算過（`nodeCount` 宣告後從未
 * 被遞增，永遠回傳 0），已一併移除這個欄位而不是留著一個假的 0。
 *
 * Actual size reduction varies a lot by source SVG (precision/redundancy in the input) — the old
 * "60% ~ 75%" figure was an unverified number, not measured against any benchmark in this repo.
 * `reductionPercent` in the result is the real measured value for whatever was just optimized.
 */

export interface SvgOptimizationResult {
  optimizedSvg: string;
  originalSize: number;
  optimizedSize: number;
  reductionPercent: number;
}

export class SvgPathOptimizer {
  /**
   * Optimizes an SVG string for laser cutting plotters and web rendering
   */
  public static optimize(svgContent: string, precision: number = 1): SvgOptimizationResult {
    const originalSize = svgContent.length;

    // 1. Clean xml comments and doctypes to avoid parser quirks
    let clean = svgContent
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\?xml[\s\S]*?\?>/g, '')
      .trim();

    // 2. Optimize coordinate precision inside path `d="..."` attributes
    clean = clean.replace(/d="([^"]+)"/g, (_, pathData: string) => {
      const optimizedPath = this.optimizePathData(pathData, precision);
      return `d="${optimizedPath}"`;
    });

    // 3. Remove redundant whitespace between SVG tags
    clean = clean
      .replace(/\s{2,}/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();

    const optimizedSize = clean.length;
    const reductionPercent = Math.max(0, Math.round(((originalSize - optimizedSize) / originalSize) * 100));

    return {
      optimizedSvg: clean,
      originalSize,
      optimizedSize,
      reductionPercent
    };
  }

  /**
   * Optimizes path d attribute commands and coordinates
   */
  private static optimizePathData(d: string, precision: number): string {
    // Replace excessive float decimals with clamped decimals
    return d.replace(/-?\d+\.\d+/g, (numStr) => {
      const num = parseFloat(numStr);
      return Number(num.toFixed(precision)).toString();
    })
    // Remove unnecessary spaces around command letters
    .replace(/\s*([MmLlHhVvCcSsQqTtAaZz])\s*/g, '$1')
    // Remove redundant zeros (e.g. 0.5 ➔ .5, 0 0 ➔ 0 0)
    .replace(/\s+/g, ' ')
    .trim();
  }
}
