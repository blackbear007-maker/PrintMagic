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
    // 2. Aspect Ratio Match Score (Weight: 15%) - Auto-Orientation + Extreme Advisory
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

      // Detect extreme aspect ratio mismatch (>2.5x ratio gap, e.g. 21:9 panorama vs A4 portrait)
      const imgRatioExtreme = Math.max(imgAspect, 1 / imgAspect);
      const targetRatioExtreme = Math.max(targetAspectNormal, 1 / targetAspectNormal);
      const ratioGap = Math.max(imgRatioExtreme, targetRatioExtreme) / Math.min(imgRatioExtreme, targetRatioExtreme);
      const isExtremeMismatch = ratioGap > 1.8;

      if (isExtremeMismatch) {
        // Advisory mode: honest about mismatch but floor at 75 since it's a deliberate user choice
        aspectRatioScore = 75;
        const isWide = imgAspect > 2;
        const isTall = imgAspect < 0.5;
        if (isWide) {
          issues.push('偵測到超寬版型 (21:9 全景)，建議改用「A4 橫向」或「A3 橫向」版面以完整保留畫面');
          recommendations.push('💡 建議規格：A4 Landscape (297×210mm) 或 A3 Landscape (420×297mm)');
        } else if (isTall) {
          issues.push('偵測到超長直條版型 (書籤/書卡)，建議改用「明信片」或自訂尺寸版面');
          recommendations.push('💡 建議規格：藝術明信片 (148×100mm 橫式) 或自訂長條版型');
        } else {
          issues.push('圖片長寬比與目標規格差異極大，送印可能裁切大量內容');
        }
      } else if (optimalDiff > 0.15) {
        const cropLossPct = Math.round(optimalDiff * 100);
        aspectRatioScore = Math.max(75, Math.round((1 - optimalDiff * 0.5) * 100));
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
    // 4. Saturation & Gamut Score (Weight: 10%) — Gamut Overflow Rate Priority
    // ─────────────────────────────────────────────────────────────
    let saturationScore = 100;
    // Prefer gamutOverflowRatio from v2 analyzePixels if available
    const oogRatio = stats.gamutOverflowRatio ?? 0;
    if (oogRatio > 0.12) {
      saturationScore = Math.max(78, 100 - oogRatio * 160);
      issues.push(`偵測到 ${Math.round(oogRatio * 100)}% 像素超出 CMYK 印刷色域，實體印刷可能出現明顯色衰`);
      recommendations.push('💡 建議開啟「CMYK 軟打樣」預覽；或向印刷廠指定 Pantone 螢光專色油墨');
    } else if (stats.avgSat > 0.82 && oogRatio <= 0.02) {
      saturationScore = 92; // High saturation but mostly in-gamut — minor advisory
      recommendations.push('💡 色彩鮮豔飽和，建議確認印刷廠使用高品質 UV 油墨以重現螢光感');
    } else if (stats.avgSat > 0.82) {
      saturationScore = 88;
      issues.push('檢測到極高飽和螢光色域，實體 CMYK 常規四色油墨可能略有色衰');
      recommendations.push('💡 建議開啟「CMYK 軟打樣」預覽；或向印刷廠指定【Pantone 螢光專色油墨】');
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Contrast Score (Weight: 10%)
    // ─────────────────────────────────────────────────────────────
    let contrastScore = 100;
    if (stats.stdLum < 0.05) {
      contrastScore = Math.max(70, Math.round((stats.stdLum / 0.05) * 100));
      issues.push('畫面整體反差偏弱，印在紙張上容易顯得灰暗缺乏層次');
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Sharpness & Edge Definition Score (Weight: 10%)
    // ─────────────────────────────────────────────────────────────
    let sharpnessScore = 100;
    if (stats.edgeScore < 0.03) {
      sharpnessScore = Math.max(55, Math.round((stats.edgeScore / 0.03) * 100));
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
   * Stride-Adaptive pixel statistical analysis v2
   * Upgrades vs v1:
   * 1. Sobel 3×3 + 45° diagonal edge detection (vs 1st-order diff → better for angled edges)
   * 2. Histogram P5/P95 dynamic range spread (vs stdLum → true contrast measurement)
   * 3. Gamut overflow rate: % of sRGB pixels outside CMYK gamut (vs raw avgSat)
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

    // Luminance histogram for P5/P95 percentile dynamic range
    const LUM_BINS = 256;
    const lumHist = new Uint32Array(LUM_BINS);
    let gamutOverflowCount = 0;

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

      // Histogram bin
      const bin = Math.min(255, Math.round(lum * 255));
      lumHist[bin]++;

      // CMYK gamut risk check: flags pixels likely to shift noticeably when printed in CMYK.
      //
      // ⚠️ 2026-08-28 修正一個真實存在的計算錯誤，過程中也記錄一個「看似合理但驗證後是錯的」修正嘗試：
      //
      // 舊版用 `k=1-max` 當底色的簡化公式算「CMYK round-trip」，但這個公式代數上是個恆等式——對任何
      // max<1 的輸入，rBack/gBack/bBack 展開後恆等於原始 r/g/b（可手動代入驗證：c=(max-r)/max，
      // rBack=(1-c)*(1-k)=(1-c)*max=max-(max-r)=r，g/b 同理），所以 `diff` 幾乎永遠算出接近 0，
      // 導致這個佔總分 10% 權重的「超出印刷色域」偵測，對任何圖片實際上都不會觸發。
      //
      // 第一次修正嘗試：改用本站真實送印會用的 `CmykEngine.rgbToCmyk()`/`cmykToRgb()`（Bradford
      // D65→D50 色適應 + 自適應 GCR）做 round-trip，門檻沿用 `CmykEngine.analyzeGamut()` 的 38。
      // 用真實色域網格抽樣驗證後發現這個訊號是「反的」：純飽和原色（255,0,0 等）因為 GCR 為 0、
      // 二色分離可完美還原，diff=0（誤判為色域內）；但普通可印刷的品牌紅（220,40,40，未飽和到底）
      // GCR 真的丟失資訊，diff=145（誤判為嚴重超出色域）——GCR 是有損的油墨分配選擇，不是色域邊界，
      // 拿它的 round-trip 差異當色域指標，量到的其實是「GCR 丟了多少資訊」而不是「印得出來嗎」。
      //
      // 第二次嘗試：檢查 Bradford 適應後、GCR 之前的 D50 RGB 是否需要被夾在 [0,1] 之外——這是数學上
      // 真正的色域邊界訊號，跟 GCR 無關。但實測發現這個簡化模型（線性減色法 + Bradford CAT，沒有真實
      // 油墨光譜/印刷描述檔資料）對任何合法 sRGB 輸入，D50 RGB 從未真正超出 [0,1]——這個矩陣本身就
      // 不會製造出可偵測的邊界，跟 `icc-profiles.ts` 已經誠實揭露的限制一致：沒有真正 `.icc` 描述檔
      // 就沒有真正的色域邊界可算（真正的 ICC 色域檢查只能透過非同步的自建服務 `free-icc-client.ts`，
      // 不適合這裡的同步逐像素迴圈）。
      //
      // 最終改用一個誠實標註為「粗略經驗法則」的判準：高飽和度 + 高亮度的顏色，在真實印刷經驗中最常
      // 見螢幕與紙本的明顯色差（尤其是飽和的綠/藍/青，這正是 sRGB 螢幕色域比 CMYK 印刷色域寬最多的
      // 區域）——不是精確的色域邊界測試，但至少方向正確（純飽和原色會被標記，膚色/粉彩/中性色不會），
      // 不像上面兩次嘗試那樣在數學上失效或反向。
      if (sat > 0.75 && max > 0.4) {
        gamutOverflowCount++;
      }
    }

    // Compute P5 / P95 percentile luminance for true dynamic range spread
    const p5Target = sampledCount * 0.05;
    const p95Target = sampledCount * 0.95;
    let cumulative = 0;
    let p5Lum = 0, p95Lum = 1;
    for (let bin = 0; bin < LUM_BINS; bin++) {
      cumulative += lumHist[bin];
      if (cumulative >= p5Target && p5Lum === 0 && bin > 0) p5Lum = bin / 255;
      if (cumulative >= p95Target) { p95Lum = bin / 255; break; }
    }
    // Dynamic range spread (0=flat, 1=full range)
    const dynamicRangeSpread = Math.max(0, p95Lum - p5Lum);

    // ── Sobel 3×3 edge detection (+ 45° diagonals for complete coverage) ──
    let edgeSum = 0;
    const edgeStepY = Math.max(2, Math.floor(height / 220));
    const edgeStepX = Math.max(2, Math.floor(width / 220));
    let edgeSampledCount = 0;

    const inv765 = 0.0013071895; // 1/765

    for (let y = 1; y < height - 1; y += edgeStepY) {
      for (let x = 1; x < width - 1; x += edgeStepX) {
        edgeSampledCount++;
        // Fetch 3×3 luminances
        const l = (y2: number, x2: number) => {
          const ii = (y2 * width + x2) * 4;
          return (data[ii] + data[ii + 1] + data[ii + 2]) * inv765;
        };

        const p00 = l(y - 1, x - 1); const p01 = l(y - 1, x); const p02 = l(y - 1, x + 1);
        const p10 = l(y,     x - 1);                            const p12 = l(y,     x + 1);
        const p20 = l(y + 1, x - 1); const p21 = l(y + 1, x); const p22 = l(y + 1, x + 1);

        // Sobel horizontal Gx
        const gx = -p00 - 2 * p10 - p20 + p02 + 2 * p12 + p22;
        // Sobel vertical Gy
        const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;
        // Diagonal Gd1 (Scharr-like 45°)
        const gd1 = -p01 - 2 * p02 + p10 + p12 - 2 * p20 + p21; // simplified
        // Gradient magnitude (L2 norm of all axes)
        edgeSum += Math.sqrt(gx * gx + gy * gy + 0.5 * gd1 * gd1) * 0.5;
      }
    }

    const avgLum = sampledCount > 0 ? totalLum / sampledCount : 0.5;
    const avgSat = sampledCount > 0 ? totalSat / sampledCount : 0.5;
    const stdLum = sampledCount > 0
      ? Math.sqrt(Math.max(0, sumSqLum / sampledCount - avgLum * avgLum))
      : 0.2;
    // Use dynamic range spread to augment stdLum for better contrast estimation
    const effectiveStdLum = stdLum * 0.7 + dynamicRangeSpread * 0.15;
    const edgeScore = edgeSampledCount > 0 ? edgeSum / edgeSampledCount : 0.04;
    const gamutOverflowRatio = sampledCount > 0 ? gamutOverflowCount / sampledCount : 0;

    return {
      avgLum,
      avgSat,
      stdLum: effectiveStdLum,
      edgeScore,
      transparentRatio: sampledCount > 0 ? transparent / sampledCount : 0,
      gamutOverflowRatio,
      dynamicRangeSpread,
      width,
      height
    };
  }
}

