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
    if (preset.id === 'social' || preset.widthMm <= 0 || preset.heightMm <= 0) {
      const targetW = 1080;
      const targetH = 1080;
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

    // Determine recommended integer upscale factor (2x, 4x, etc.) with safe memory capping (max 4500px)
    let scaleFactor = 1;
    const targetDpi = preset.targetDpi;
    const maxCurrentDim = Math.max(widthPx, heightPx);
    const MAX_SAFE_DIM = 4500;

    if (currentDpi < targetDpi && maxCurrentDim < MAX_SAFE_DIM) {
      const ratio = targetDpi / Math.max(1, currentDpi);
      let calculatedScale = Math.min(4, Math.max(2, Math.ceil(ratio)));
      
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
      needsUpscale: currentDpi < 280 && scaleFactor > 1,
      widthPx,
      heightPx,
      targetWidthPx,
      targetHeightPx,
      message
    };
  }
}
