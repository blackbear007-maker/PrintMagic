import type {
  ImagePixelStats,
  InkAnalysis,
  PrintPreset,
  PrintScoreResult,
  ScoreBreakdown
} from '../types';
import { DpiCalculator } from './dpi-calculator';

/**
 * Honest 7-Factor Print Readiness Scoring Algorithm (0 - 100)
 */
export class PrintScoreCalculator {
  public static calculate(
    stats: ImagePixelStats,
    preset: PrintPreset,
    inkAnalysis?: InkAnalysis
  ): PrintScoreResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 1. Resolution Score (Weight: 35%)
    const dpiAnalysis = DpiCalculator.analyze(stats.width, stats.height, preset);
    let resolutionScore = 100;

    if (dpiAnalysis.currentDpi >= 280) {
      resolutionScore = 100;
    } else if (dpiAnalysis.currentDpi >= 200) {
      resolutionScore = 80 + ((dpiAnalysis.currentDpi - 200) / 80) * 20;
      issues.push(`解析度為 ${dpiAnalysis.currentDpi} DPI，達到基本標準但略低於印刷廠 300 DPI 推薦值`);
    } else if (dpiAnalysis.currentDpi >= 140) {
      resolutionScore = 50 + ((dpiAnalysis.currentDpi - 140) / 60) * 30;
      issues.push(`解析度不足 (${dpiAnalysis.currentDpi} DPI)，實體輸出細部可能略有模糊`);
      recommendations.push(`建議套用 ${dpiAnalysis.scaleFactor}x 無失真放大`);
    } else {
      resolutionScore = Math.max(10, (dpiAnalysis.currentDpi / 140) * 50);
      issues.push(`解析度嚴重不足 (${dpiAnalysis.currentDpi} DPI)，印刷將出現明顯馬賽克鋸齒`);
      recommendations.push(`強烈建議套用 ${dpiAnalysis.scaleFactor}x 超解析度放大或更換高解析度圖片`);
    }

    // 2. Aspect Ratio Match Score (Weight: 15%)
    let aspectRatioScore = 100;
    if (preset.widthMm > 0 && preset.heightMm > 0) {
      const imgAspect = stats.width / stats.height;
      const targetAspect = preset.widthMm / preset.heightMm;
      const aspectDiff =
        Math.abs(imgAspect - targetAspect) / Math.max(imgAspect, targetAspect);

      if (aspectDiff > 0.12) {
        aspectRatioScore = Math.max(40, Math.round((1 - aspectDiff) * 100));
        issues.push('圖片比例與目標印刷品尺寸不符，出血或裁切時邊緣內容可能被裁切');
        recommendations.push('請留意重要主體是否落在安全框內');
      }
    }

    // 3. Brightness & Shadow Score (Weight: 10%)
    let brightnessScore = 100;
    if (stats.avgLum < 0.16) {
      brightnessScore = Math.max(30, Math.round((stats.avgLum / 0.16) * 100));
      issues.push('畫面整體偏暗，實體印刷受紙張吸墨影響將比螢幕顯示更暗');
      recommendations.push('建議微調提亮暗部階調');
    } else if (stats.avgLum > 0.92) {
      brightnessScore = Math.max(50, Math.round(((1 - stats.avgLum) / 0.08) * 100));
      issues.push('畫面高光極亮，亮部漸層在印刷中可能產生斷階白斑');
    }

    // 4. Saturation & Gamut Score (Weight: 10%)
    let saturationScore = 100;
    if (stats.avgSat > 0.82) {
      saturationScore = Math.max(40, Math.round(((1 - stats.avgSat) / 0.18) * 100));
      issues.push('色彩極高飽和（螢光色域），轉為印刷 CMYK 後將產生色彩衰退');
      recommendations.push('建議開啟 CMYK 軟打樣預覽實體印出色澤');
    }

    // 5. Contrast Score (Weight: 10%)
    let contrastScore = 100;
    if (stats.stdLum < 0.1) {
      contrastScore = Math.max(40, Math.round((stats.stdLum / 0.1) * 100));
      issues.push('畫面整體反差偏弱，印在紙張上容易顯得灰暗缺乏層次');
    }

    // 6. Sharpness & Edge Definition Score (Weight: 10%)
    let sharpnessScore = 100;
    if (stats.edgeScore < 0.025) {
      sharpnessScore = Math.max(35, Math.round((stats.edgeScore / 0.025) * 100));
      issues.push('圖像細節線條邊緣偏軟，缺乏印刷所需的銳利度');
      recommendations.push('系統已自動準備 Pre-press 細部銳化補償');
    }

    // 7. TAC Ink Safety Score (Weight: 10%)
    let inkSafetyScore = 100;
    if (inkAnalysis && inkAnalysis.hasOverflow) {
      if (inkAnalysis.maxTotalInk > 340) {
        inkSafetyScore = Math.max(30, 100 - (inkAnalysis.maxTotalInk - 300) * 1.5);
        issues.push(`檢測到局部油墨總量達到 ${inkAnalysis.maxTotalInk}% (上限 300%)，可能造成乾燥困難與背印污損`);
        recommendations.push('系統已自動啟用 TAC 墨量壓制保護');
      } else {
        inkSafetyScore = 80;
        issues.push(`微量像素超過總墨量限制 (${inkAnalysis.maxTotalInk}%)`);
      }
    }

    // Weighted Overall Score Calculation
    const breakdown: ScoreBreakdown = {
      resolution: Math.round(resolutionScore),
      aspectRatio: Math.round(aspectRatioScore),
      brightness: Math.round(brightnessScore),
      saturation: Math.round(saturationScore),
      contrast: Math.round(contrastScore),
      sharpness: Math.round(sharpnessScore),
      inkSafety: Math.round(inkSafetyScore)
    };

    const weightedScore = Math.round(
      breakdown.resolution * 0.35 +
      breakdown.aspectRatio * 0.15 +
      breakdown.brightness * 0.10 +
      breakdown.saturation * 0.10 +
      breakdown.contrast * 0.10 +
      breakdown.sharpness * 0.10 +
      breakdown.inkSafety * 0.10
    );

    const score = Math.max(0, Math.min(100, weightedScore));

    let verdict: string;
    let level: 'high' | 'mid' | 'low';

    if (score >= 88) {
      level = 'high';
      verdict = '✅ 完美就緒 — 已達專業印刷廠直出標準';
    } else if (score >= 70) {
      level = 'mid';
      verdict = '⚠️ 良好 — 經過一鍵自動優化後可直接送印';
    } else {
      level = 'low';
      verdict = '❌ 需補強 — 解析度或色彩偏離印刷規格，請確認優化項目';
    }

    return {
      score,
      verdict,
      level,
      breakdown,
      issues,
      recommendations
    };
  }

  /**
   * Fast pixel statistical analysis
   */
  public static analyzePixels(imageData: ImageData): ImagePixelStats {
    const { width, height, data } = imageData;
    const count = width * height;
    let totalLum = 0;
    let totalSat = 0;
    let sumSqLum = 0;
    let edgeSum = 0;
    let transparent = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const a = data[i + 3];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (max + min) / 2;
      const sat = max === 0 ? 0 : (max - min) / max;

      totalLum += lum;
      totalSat += sat;
      sumSqLum += lum * lum;
      if (a < 255) transparent++;
    }

    // Fast edge gradient detection
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = (y * width + x) * 4;
        const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 765;
        const rightLum = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 765;
        const downIdx = ((y + 1) * width + x) * 4;
        const downLum = (data[downIdx] + data[downIdx + 1] + data[downIdx + 2]) / 765;
        edgeSum += Math.abs(lum - rightLum) + Math.abs(lum - downLum);
      }
    }

    const avgLum = count > 0 ? totalLum / count : 0.5;
    const avgSat = count > 0 ? totalSat / count : 0.5;
    const stdLum = count > 0 ? Math.sqrt(Math.max(0, sumSqLum / count - avgLum * avgLum)) : 0.2;
    const sampledCount = (Math.floor((height - 2) / 2) * Math.floor((width - 2) / 2)) || 1;
    const edgeScore = edgeSum / sampledCount;

    return {
      avgLum,
      avgSat,
      stdLum,
      edgeScore,
      transparentRatio: count > 0 ? transparent / count : 0,
      width,
      height
    };
  }
}
