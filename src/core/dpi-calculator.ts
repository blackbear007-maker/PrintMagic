import type { DpiAnalysis, DpiQualityTier, PrintPreset } from '../types';

/**
 * High-precision DPI and Dimension Calculator
 */
export class DpiCalculator {
  private static readonly MM_PER_INCH = 25.4;

  /**
   * Convert physical millimeters to required pixel count at given DPI
   */
  public static mmToPx(mm: number, dpi: number): number {
    if (mm <= 0) return 0;
    return Math.round((mm / this.MM_PER_INCH) * dpi);
  }

  /**
   * Convert pixel count to millimeters at given DPI
   */
  public static pxToMm(px: number, dpi: number): number {
    if (dpi <= 0) return 0;
    return (px / dpi) * this.MM_PER_INCH;
  }

  /**
   * Calculate effective DPI and upscale requirements for a given image and print preset
   */
  public static analyze(
    widthPx: number,
    heightPx: number,
    preset: PrintPreset
  ): DpiAnalysis {
    // Special handling for digital social media preset
    //
    // ⚠️ 2026-08-29 修正：這裡曾經不管圖片方向、一律回傳 1080×1080（正方形）當目標尺寸，但
    // `presets.ts` 裡 `social` 這個唯一會走到這個分支的預設，自己宣稱的規格是「1080 × 1920 px」
    // （直式 9:16），跟這裡回傳的正方形完全對不上——診斷卡片會把錯誤的目標尺寸顯示給使用者。
    // 已改成依照使用者圖片本身的直向/橫向，回傳對應方向的 1080×1920（或 1920×1080），
    // 而不是寫死一個正方形；下面的 `currentMin`/`targetMin` 品質門檻邏輯不受影響，維持原樣。
    if (preset.id === 'social' || preset.widthMm <= 0 || preset.heightMm <= 0) {
      const isPortraitOrSquare = heightPx >= widthPx;
      const targetW = isPortraitOrSquare ? 1080 : 1920;
      const targetH = isPortraitOrSquare ? 1920 : 1080;
      const currentMin = Math.min(widthPx, heightPx);
      const targetMin = 1080;
      const scaleFactor = currentMin < targetMin ? Math.ceil(targetMin / currentMin) : 1;

      return {
        currentDpi: 72,
        targetDpi: 72,
        qualityTier: currentMin >= targetMin ? 'excellent' : 'warning',
        scaleFactor,
        needsUpscale: scaleFactor > 1,
        widthPx,
        heightPx,
        targetWidthPx: targetW,
        targetHeightPx: targetH,
        message: currentMin >= targetMin ? '✓ 符合社群超清推薦解析度' : '⚠️ 尺寸偏小，已自動匹配畫素'
      };
    }

    // Physical print scenario
    const targetWidthPx = this.mmToPx(preset.widthMm, preset.targetDpi);
    const targetHeightPx = this.mmToPx(preset.heightMm, preset.targetDpi);

    // Determine orientation matching (allow portrait / landscape auto-fit)
    const isImageLandscape = widthPx >= heightPx;
    const isPresetLandscape = preset.widthMm >= preset.heightMm;

    let targetLongerMm: number;
    let targetShorterMm: number;
    let imageLongerPx: number;
    let imageShorterPx: number;

    if (isImageLandscape) {
      imageLongerPx = widthPx;
      imageShorterPx = heightPx;
    } else {
      imageLongerPx = heightPx;
      imageShorterPx = widthPx;
    }

    if (isPresetLandscape) {
      targetLongerMm = preset.widthMm;
      targetShorterMm = preset.heightMm;
    } else {
      targetLongerMm = preset.heightMm;
      targetShorterMm = preset.widthMm;
    }

    // Calculate actual DPI based on physical output dimensions
    const dpiX = (imageLongerPx / targetLongerMm) * this.MM_PER_INCH;
    const dpiY = (imageShorterPx / targetShorterMm) * this.MM_PER_INCH;
    const currentDpi = Math.round(Math.min(dpiX, dpiY));

    // Determine Quality Tier
    let qualityTier: DpiQualityTier;
    let message: string;

    if (currentDpi >= 280) {
      qualityTier = 'excellent';
      message = `✓ 印刷級解析度 (${currentDpi} DPI)，細節極致銳利`;
    } else if (currentDpi >= 200) {
      qualityTier = 'good';
      message = `✓ 照片級解析度 (${currentDpi} DPI)，標準距離觀看清晰`;
    } else if (currentDpi >= 140) {
      qualityTier = 'warning';
      message = `⚠️ 解析度偏低 (${currentDpi} DPI)，建議啟動無失真放大`;
    } else {
      qualityTier = 'critical';
      message = `❌ 解析度嚴重不足 (${currentDpi} DPI)，實體印刷將出現馬賽克`;
    }

    // Determine recommended integer upscale factor (2x, 4x, 8x) with safe memory capping (max 6000px)
    let scaleFactor = 1;
    const targetDpi = preset.targetDpi;
    const maxCurrentDim = Math.max(widthPx, heightPx);
    const MAX_SAFE_DIM = 6000;

    if (currentDpi < targetDpi && maxCurrentDim < MAX_SAFE_DIM) {
      const ratio = targetDpi / Math.max(1, currentDpi);
      let calculatedScale = Math.min(8, Math.max(2, Math.ceil(ratio)));
      
      // Ensure we do not scale beyond safe memory limits
      while (calculatedScale > 1 && maxCurrentDim * calculatedScale > MAX_SAFE_DIM) {
        calculatedScale--;
      }
      scaleFactor = calculatedScale;
    }

    return {
      currentDpi,
      targetDpi,
      qualityTier,
      scaleFactor,
      // Only trigger upscale when below the preset's actual target DPI requirement
      needsUpscale: currentDpi < targetDpi && scaleFactor > 1,
      widthPx,
      heightPx,
      targetWidthPx,
      targetHeightPx,
      message
    };
  }
}
