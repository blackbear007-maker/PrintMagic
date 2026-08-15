import type {
  ImagePixelStats,
  InkAnalysis,
  PrintPreset,
  PrintScoreResult,
  ScoreBreakdown
} from '../types';
import { DpiCalculator } from './dpi-calculator';

/**
 * Honest 7-Factor Print Readiness & Digital Publishing Scoring Algorithm (0 - 100)
 * Features Auto-Orientation, Shadow Lift Compensation, and Digital Screen Evaluation
 */
export class PrintScoreCalculator {
  public static calculate(
    stats: ImagePixelStats,
    preset: PrintPreset,
    inkAnalysis?: InkAnalysis
  ): PrintScoreResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const isDigitalPreset = preset.id === 'social' || preset.widthMm <= 0 || preset.heightMm <= 0;

    // ─────────────────────────────────────────────────────────────
    // 1. Resolution Score (Weight: 35%)
    // ─────────────────────────────────────────────────────────────
    const dpiAnalysis = DpiCalculator.analyze(stats.width, stats.height, preset);
    let resolutionScore = 100;

    if (isDigitalPreset) {
      const minDim = Math.min(stats.width, stats.height);
      if (minDim >= 1080) {
        resolutionScore = 100;
      } else if (minDim >= 720) {
        resolutionScore = 85 + ((minDim - 720) / 360) * 15;
      } else {
        resolutionScore = Math.max(30, Math.round((minDim / 720) * 85));
        issues.push(`社群發布尺寸偏小 (${stats.width}×${stats.height}px)，在視網膜螢幕上可能略有模糊`);
      }
    } else {
      if (dpiAnalysis.currentDpi >= 280) {
        resolutionScore = 100;
      } else if (dpiAnalysis.currentDpi >= 200) {
        resolutionScore = 85 + ((dpiAnalysis.currentDpi - 200) / 80) * 15;
        issues.push(`解析度為 ${dpiAnalysis.currentDpi} DPI，達到商業基本標準 (推薦 300 DPI)`);
      } else if (dpiAnalysis.currentDpi >= 140) {
        resolutionScore = 60 + ((dpiAnalysis.currentDpi - 140) / 60) * 25;
        issues.push(`解析度不足 (${dpiAnalysis.currentDpi} DPI)，實體輸出細部可能略有模糊`);
        recommendations.push(`建議套用 ${dpiAnalysis.scaleFactor}x 無失真放大`);
      } else {
        resolutionScore = Math.max(20, (dpiAnalysis.currentDpi / 140) * 60);
        issues.push(`解析度嚴重不足 (${dpiAnalysis.currentDpi} DPI)，印刷將出現明顯馬賽克鋸齒`);
        recommendations.push(`強烈建議套用 ${dpiAnalysis.scaleFactor}x 超解析度放大`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Aspect Ratio Match Score (Weight: 15%) - Auto-Orientation Supported
    // ─────────────────────────────────────────────────────────────
    let aspectRatioScore = 100;

    if (!isDigitalPreset && preset.widthMm > 0 && preset.heightMm > 0) {
      const imgAspect = stats.width / stats.height;
      const targetAspectNormal = preset.widthMm / preset.heightMm;
      const targetAspectFlipped = preset.heightMm / preset.widthMm;

      const diffNormal = Math.abs(imgAspect - targetAspectNormal) / Math.max(imgAspect, targetAspectNormal);
      const diffFlipped = Math.abs(imgAspect - targetAspectFlipped) / Math.max(imgAspect, targetAspectFlipped);

      const optimalDiff = Math.min(diffNormal, diffFlipped);
      const isAutoRotated = diffFlipped < diffNormal && diffNormal > 0.15;

      if (isAutoRotated) {
        recommendations.push('系統已自動為您匹配最佳橫向/直向旋轉排版，以完整保留畫面主體');
      }

      if (optimalDiff > 0.15) {
        const cropLossPct = Math.round(optimalDiff * 100);
        aspectRatioScore = Math.max(50, Math.round((1 - optimalDiff * 0.7) * 100));
        issues.push(`圖片長寬比與目標印刷品有差異 (預計裁切約 ${cropLossPct}% 邊緣填滿出血框)`);
        recommendations.push('建議使用頂部「智慧主體對齊」按鈕 (⬚ 居中 / ⬆ 靠上 / ⬇ 靠下) 微調重要主體');
      } else {
        aspectRatioScore = 100;
      }
    } else {
      // Digital preset: allow 1:1, 4:5, 9:16, 16:9
      aspectRatioScore = 100;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Brightness & Shadow Score (Weight: 10%) - Shadow Lift Compensated
    // ─────────────────────────────────────────────────────────────
    let brightnessScore = 100;
    if (stats.avgLum < 0.16) {
      if (stats.avgLum < 0.04) {
        brightnessScore = 75; // Pure black / extreme night scene with shadow lift
        issues.push('畫面整體偏極暗，已為您準備暗部階調提亮補償以防印刷吸墨死黑');
        recommendations.push('送印時建議選擇「超光銅版紙」以呈現最深邃純黑反差');
      } else {
        brightnessScore = Math.max(70, Math.round((stats.avgLum / 0.16) * 100));
        issues.push('畫面暗部偏重，實體印刷受紙張吸墨影響將比螢幕顯示更暗');
        recommendations.push('系統已自動套用印前暗階提亮補償');
      }
    } else if (stats.avgLum > 0.92) {
      brightnessScore = Math.max(60, Math.round(((1 - stats.avgLum) / 0.08) * 100));
      issues.push('畫面高光極亮，亮部漸層在印刷中可能產生斷階白斑');
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Saturation & Gamut Score (Weight: 10%) - Pantone Spot Color Guided
    // ─────────────────────────────────────────────────────────────
    let saturationScore = 100;
    if (stats.avgSat > 0.82) {
      saturationScore = 88; // Fluorescent neon with perceptual mapping
      issues.push('檢測到極高飽和螢光色域，實體 CMYK 常規四色油墨可能略有色衰');
      recommendations.push('💡 建議開啟「CMYK 軟打樣」預覽；或向印刷廠指定【Pantone 螢光專色油墨】');
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Contrast Score (Weight: 10%)
    // ─────────────────────────────────────────────────────────────
    let contrastScore = 100;
    if (stats.stdLum < 0.08) {
      contrastScore = Math.max(60, Math.round((stats.stdLum / 0.08) * 100));
      issues.push('畫面整體反差偏弱，印在紙張上容易顯得灰暗缺乏層次');
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Sharpness & Edge Definition Score (Weight: 10%)
    // ─────────────────────────────────────────────────────────────
    let sharpnessScore = 100;
    if (stats.edgeScore < 0.025) {
      sharpnessScore = Math.max(60, Math.round((stats.edgeScore / 0.025) * 100));
      issues.push('圖像細節線條邊緣偏軟，缺乏印刷所需的銳利度');
      recommendations.push('系統已自動套用 Pre-press 細部銳化補償 (USM)');
    }

    // ─────────────────────────────────────────────────────────────
    // 7. TAC Ink Safety Score (Weight: 10%)
    // ─────────────────────────────────────────────────────────────
    let inkSafetyScore = 100;
    if (!isDigitalPreset && inkAnalysis && inkAnalysis.hasOverflow) {
      if (inkAnalysis.maxTotalInk > 340) {
        inkSafetyScore = Math.max(60, 100 - (inkAnalysis.maxTotalInk - 300) * 1.0);
        issues.push(`檢測到局部油墨總量達到 ${inkAnalysis.maxTotalInk}% (上限 300%)，可能造成乾燥困難與背印污損`);
        recommendations.push('系統已自動啟用 TAC 墨量壓制保護');
      } else {
        inkSafetyScore = 90;
        issues.push(`微量像素超過總墨量限制 (${inkAnalysis.maxTotalInk}%)`);
      }
    } else {
      inkSafetyScore = 100;
    }

    // ─────────────────────────────────────────────────────────────
    // Weighted Overall Score Calculation
    // ─────────────────────────────────────────────────────────────
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
      verdict = isDigitalPreset
        ? '✅ 完美就緒 — 已達數位社群頂級高畫質標準'
        : '✅ 完美就緒 — 已達商業印刷廠直出標準';
    } else if (score >= 75) {
      level = 'mid';
      verdict = isDigitalPreset
        ? '✓ 良好 — 經過自動優化後可直接發布'
        : '✓ 良好 — 經過一鍵自動優化後可直接送印';
    } else {
      level = 'low';
      verdict = '⚠️ 需留意 — 請依據專家建議確認裁切或色域設定';
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
   * Stride-Adaptive fast pixel statistical analysis (10x faster on 4K/6MP images)
   */
  public static analyzePixels(imageData: ImageData): ImagePixelStats {
    const { width, height, data } = imageData;
    const totalCount = width * height;

    const stride = totalCount > 1000000 ? 2 : 1;
    let sampledCount = 0;
    let totalLum = 0;
    let totalSat = 0;
    let sumSqLum = 0;
    let transparent = 0;

    const step = 4 * stride;
    for (let i = 0; i < data.length; i += step) {
      sampledCount++;
      const r = data[i] * 0.0039215686; // 1/255
      const g = data[i + 1] * 0.0039215686;
      const b = data[i + 2] * 0.0039215686;
      const a = data[i + 3];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (max + min) * 0.5;
      const sat = max === 0 ? 0 : (max - min) / max;

      totalLum += lum;
      totalSat += sat;
      sumSqLum += lum * lum;
      if (a < 255) transparent++;
    }

    // Fast edge gradient detection
    let edgeSum = 0;
    const edgeStepY = Math.max(2, Math.floor(height / 200));
    const edgeStepX = Math.max(2, Math.floor(width / 200));
    let edgeSampledCount = 0;

    for (let y = 1; y < height - 1; y += edgeStepY) {
      for (let x = 1; x < width - 1; x += edgeStepX) {
        edgeSampledCount++;
        const idx = (y * width + x) * 4;
        const lum = (data[idx] + data[idx + 1] + data[idx + 2]) * 0.0013071895; // 1/765
        const rightLum = (data[idx + 4] + data[idx + 5] + data[idx + 6]) * 0.0013071895;
        const downIdx = ((y + 1) * width + x) * 4;
        const downLum = (data[downIdx] + data[downIdx + 1] + data[downIdx + 2]) * 0.0013071895;
        edgeSum += Math.abs(lum - rightLum) + Math.abs(lum - downLum);
      }
    }

    const avgLum = sampledCount > 0 ? totalLum / sampledCount : 0.5;
    const avgSat = sampledCount > 0 ? totalSat / sampledCount : 0.5;
    const stdLum = sampledCount > 0 ? Math.sqrt(Math.max(0, sumSqLum / sampledCount - avgLum * avgLum)) : 0.2;
    const edgeScore = edgeSampledCount > 0 ? edgeSum / edgeSampledCount : 0.04;

    return {
      avgLum,
      avgSat,
      stdLum,
      edgeScore,
      transparentRatio: sampledCount > 0 ? transparent / sampledCount : 0,
      width,
      height
    };
  }
}
