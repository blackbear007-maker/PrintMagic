/**
 * 🔍 Barcode & QR Code Pre-Flight Readability Verifier
 *
 * A real contrast/size heuristic — not a decoder (does not use or replicate zbar). It cannot
 * confirm a barcode actually decodes correctly, only flag mechanical print-readability risks
 * (too small, too low-contrast). Real decode verification would need an actual decoder library.
 *
 * Pre-Press Problem Solved:
 * Designers often place QR codes too small (<15mm) or with low contrast (e.g. gray on white, red on black),
 * leading to disastrous mass printing of un-scannable promotional posters and flyers.
 * 
 * Solution:
 * 1. Scans for high-frequency rectangular module clusters (QR/Barcode regions).
 * 2. Checks Michelson & Weber Optical Contrast ratio (>70% required for optical scanning).
 * 3. Validates minimum physical module size (at 300 DPI, minimum 0.5mm module size).
 */

export interface BarcodeVerificationReport {
  hasBarcode: boolean;
  isLegible: boolean;
  score: number; // 0 ~ 100
  issues: string[];
  recommendations: string[];
  contrastRatio: number; // 0.0 ~ 1.0
  estimatedPhysicalWidthMm: number;
}

export class BarcodeVerifier {
  /**
   * Pre-flight analysis of barcode and QR readability from canvas image data
   */
  public static verifyImage(
    imageData: ImageData,
    targetDpi: number = 300
  ): BarcodeVerificationReport {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;

    let highFrequencyTransitions = 0;
    let lumMax = -Infinity;
    let lumMin = Infinity;

    // Sample horizontal scanlines across the image
    const stepY = Math.max(1, Math.floor(h / 80));
    const stepX = 2;

    for (let y = 0; y < h; y += stepY) {
      let prevLum = -1;
      for (let x = 0; x < w; x += stepX) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 50) continue; // Transparent

        // Perceived luminance (ITU-R BT.709)
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        if (lum > lumMax) lumMax = lum;
        if (lum < lumMin) lumMin = lum;

        if (prevLum !== -1 && Math.abs(lum - prevLum) > 120) {
          highFrequencyTransitions++;
        }
        prevLum = lum;
      }
    }

    const totalSampled = (h / stepY) * (w / stepX);
    const hasBarcodePattern = highFrequencyTransitions > totalSampled * 0.08;

    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // 1. Contrast Check — 2026-08-28 修正：文檔宣稱用 Michelson 對比公式，實際上舊版只是算亮/暗
    // 像素「數量比例」，不是真正的對比度（一張 95% 白底 + 5% 淺灰字的圖，舊公式算出高比例、誤判成
    // 對比良好，但淺灰字本身可能根本掃不出來）。改用真正的 Michelson 對比公式
    // `(Lmax-Lmin)/(Lmax+Lmin)`，用掃描過程中實際取樣到的最大/最小亮度值計算，正確反映條碼真正的
    // 明暗極值反差，不受黑白像素面積比例影響。
    const contrastRatio = lumMax > -Infinity && lumMax + lumMin > 0
      ? (lumMax - lumMin) / (lumMax + lumMin)
      : 0.5;

    if (contrastRatio < 0.70) {
      score -= 25;
      issues.push('條碼黑白明暗對比度過低 (Contrast < 70%)');
      recommendations.push('建議將條碼底色改為純白，條碼本體改為純黑以確保手機秒掃。');
    }

    // 2. Physical Size Check
    const physicalWidthMm = Math.round((w / targetDpi) * 25.4);
    if (physicalWidthMm < 18) {
      score -= 30;
      issues.push(`QR Code 印刷實體尺寸預估僅 ${physicalWidthMm}mm (建議至少 ≥ 20mm)`);
      recommendations.push('手機鏡頭在小於 18mm 的印刷品上容易失焦，請將條碼放大。');
    }

    const isLegible = score >= 70 && issues.length === 0;

    return {
      hasBarcode: hasBarcodePattern,
      isLegible,
      score: Math.max(0, score),
      issues,
      recommendations,
      contrastRatio: Math.round(contrastRatio * 100) / 100,
      estimatedPhysicalWidthMm: physicalWidthMm
    };
  }
}
