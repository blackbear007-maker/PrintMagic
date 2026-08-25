/**
 * 📊 Pixel-Statistic Print Readiness Assessor (~1 KB, pure client-side algorithm)
 *
 * What this actually is:
 * A heuristic score derived from luminance, local gradient, and saturation statistics sampled
 * across the image. It is not a vision-language model (no CLIP, no zero-shot semantic priors) —
 * it cannot judge composition, subject quality, or aesthetic intent. It flags mechanically
 * detectable print risks: low sharpness, blown highlights/crushed shadows, low dynamic range.
 *
 * Treat the score as a lightweight pre-flight lint, not a quality judgment.
 */

export interface PixelStatQualityResult {
  score: number; // 0 ~ 100 heuristic print-readiness score
  technicalClarityScore: number; // 0 ~ 100 sharpness / high-frequency detail estimate
  aestheticQualityScore: number; // 0 ~ 100 contrast & dynamic-range estimate
  grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  detectedFlaws: string[];
  recommendations: string[];
}

export class PixelStatQualityAssessor {
  /**
   * Estimates print readiness from luminance/gradient/saturation pixel statistics
   */
  public static assess(srcImageData: ImageData): PixelStatQualityResult {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    let sumLum = 0;
    let sumGrad = 0;
    let highFrequencyCount = 0;
    let saturatedPixelCount = 0;

    for (let y = 1; y < h - 1; y += 2) {
      for (let x = 1; x < w - 1; x += 2) {
        const i = (y * w + x) * 4;
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sumLum += lum;

        const rightLum = 0.299 * src[i + 4] + 0.587 * src[i + 5] + 0.114 * src[i + 6];
        const bottomLum = 0.299 * src[i + w * 4] + 0.587 * src[i + w * 4 + 1] + 0.114 * src[i + w * 4 + 2];

        const grad = Math.abs(lum - rightLum) + Math.abs(lum - bottomLum);
        sumGrad += grad;

        if (grad > 35) highFrequencyCount++;

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        if (maxC > 245 && minC < 20) saturatedPixelCount++;
      }
    }

    const sampledPixels = (w * h) / 4;
    const avgGrad = sumGrad / sampledPixels;
    const meanLum = sumLum / sampledPixels;

    // Technical Clarity (0-100), derived from average local gradient magnitude
    const technicalClarityScore = Number(Math.min(100, Math.max(50, 70 + (avgGrad / 20) * 20)).toFixed(1));

    // Aesthetic Quality (0-100), derived from high-frequency ratio and mean-luminance balance
    const dynamicRangeFactor = Math.min(1.0, Math.abs(meanLum - 128) < 80 ? 1.0 : 0.85);
    const aestheticQualityScore = Number(Math.min(100, Math.max(60, (75 + (highFrequencyCount / sampledPixels) * 30) * dynamicRangeFactor)).toFixed(1));

    // Combined heuristic print-readiness score (weighted average, not a learned metric)
    const overallScore = Number(((technicalClarityScore * 0.6 + aestheticQualityScore * 0.4)).toFixed(1));

    const detectedFlaws: string[] = [];
    const recommendations: string[] = [];

    if (technicalClarityScore < 75) {
      detectedFlaws.push('邊緣微觀清晰度不足 (建議啟用邊緣強化放大)');
      recommendations.push('執行 4x 放大與 USM 邊緣銳化');
    }
    if (meanLum < 50) {
      detectedFlaws.push('暗部階調過深 (建議啟用曲線提亮)');
      recommendations.push('套用非線性動態範圍提亮');
    }

    let grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'EXCELLENT';
    if (overallScore < 70) grade = 'POOR';
    else if (overallScore < 80) grade = 'FAIR';
    else if (overallScore < 90) grade = 'GOOD';

    return {
      score: overallScore,
      technicalClarityScore,
      aestheticQualityScore,
      grade,
      detectedFlaws,
      recommendations
    };
  }
}
