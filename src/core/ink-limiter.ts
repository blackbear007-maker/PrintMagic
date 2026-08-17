import type { InkAnalysis } from '../types';

/**
 * Total Area Coverage (TAC) Ink Limiter & Heatmap Analyzer
 * Protects commercial printing presses from excessive 4-color ink build-up (drying failure & smudging)
 */
export class InkLimiter {
  public static readonly DEFAULT_TAC_LIMIT = 300; // 300% industry safe standard

  /**
   * Analyze image data for 4-color ink coverage metrics
   * Evaluates CMYK four-color composite build (C + M + Y + K)
   */
  public static analyze(
    imageData: ImageData,
    threshold: number = this.DEFAULT_TAC_LIMIT
  ): InkAnalysis {
    const data = imageData.data;
    const totalPixels = data.length / 4;
    let maxTotalInk = 0;
    let sumTotalInk = 0;
    let exceededPixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // Standard CMYK separation with UCR (Under Color Removal)
      // k = black component from the darkest channel
      const k = 1 - Math.max(r, g, b);
      const denom = k < 1 ? 1 - k : 1;
      const c = (1 - r - k) / denom;
      const m = (1 - g - k) / denom;
      const y = (1 - b - k) / denom;

      const totalInk = (c + m + y + k) * 100;
      if (totalInk > maxTotalInk) {
        maxTotalInk = totalInk;
      }
      sumTotalInk += totalInk;

      if (totalInk > threshold) {
        exceededPixelCount++;
      }
    }

    const averageTotalInk = totalPixels > 0 ? sumTotalInk / totalPixels : 0;
    const exceededRatio = totalPixels > 0 ? exceededPixelCount / totalPixels : 0;

    return {
      maxTotalInk: Math.round(maxTotalInk),
      averageTotalInk: Math.round(averageTotalInk),
      exceededPixelCount,
      exceededRatio,
      hasOverflow: exceededPixelCount > 0,
      limitThreshold: threshold
    };
  }

  /**
   * Clamp excessive ink values in-place and return modified ImageData
   */
  public static clampInk(
    imageData: ImageData,
    maxLimit: number = this.DEFAULT_TAC_LIMIT
  ): { clampedImageData: ImageData; modifiedPixels: number } {
    const width = imageData.width;
    const height = imageData.height;
    const copy = new Uint8ClampedArray(imageData.data.length);
    copy.set(imageData.data);
    const output = new ImageData(copy, width, height);
    const pixels = output.data;
    let modifiedPixels = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] / 255;
      const g = pixels[i + 1] / 255;
      const b = pixels[i + 2] / 255;

      // Standard CMYK separation (same formula as analyze() for consistency)
      let k = 1 - Math.max(r, g, b);
      const denom = k < 1 ? 1 - k : 1;
      let c = (1 - r - k) / denom;
      let m = (1 - g - k) / denom;
      let y = (1 - b - k) / denom;

      const totalInk = (c + m + y + k) * 100;

      if (totalInk > maxLimit) {
        modifiedPixels++;
        // Proportional scaling to bring TAC under limit
        const factor = maxLimit / totalInk;
        c = Math.min(1, c * factor);
        m = Math.min(1, m * factor);
        y = Math.min(1, y * factor);
        k = Math.min(1, k * factor);

        // ✅ Correct CMYK → RGB formula: (1-C)*(1-K), not (1 - max(C,K))
        pixels[i]     = Math.min(255, Math.max(0, Math.round(255 * (1 - c) * (1 - k))));
        pixels[i + 1] = Math.min(255, Math.max(0, Math.round(255 * (1 - m) * (1 - k))));
        pixels[i + 2] = Math.min(255, Math.max(0, Math.round(255 * (1 - y) * (1 - k))));
      }
    }

    return {
      clampedImageData: output,
      modifiedPixels
    };
  }

  /**
   * Generate visual warning heatmap highlighting dangerous ink overflow zones
   */
  public static generateHeatmap(
    imageData: ImageData,
    threshold: number = this.DEFAULT_TAC_LIMIT
  ): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const heatmap = new ImageData(width, height);
    const src = imageData.data;
    const dst = heatmap.data;

    for (let i = 0; i < src.length; i += 4) {
      const r = src[i] / 255;
      const g = src[i + 1] / 255;
      const b = src[i + 2] / 255;

      // Unified CMYK formula matching analyze() and clampInk()
      const k = 1 - Math.max(r, g, b);
      const denom = k < 1 ? 1 - k : 1;
      const c = (1 - r - k) / denom;
      const m = (1 - g - k) / denom;
      const y = (1 - b - k) / denom;

      const totalInk = (c + m + y + k) * 100;

      if (totalInk > threshold) {
        // High danger: luminous magenta-red highlight
        const severity = Math.min(1, (totalInk - threshold) / (400 - threshold));
        dst[i] = 255; // R
        dst[i + 1] = Math.round(40 * (1 - severity)); // G
        dst[i + 2] = Math.round(120 + 135 * severity); // B
        dst[i + 3] = 220; // Alpha
      } else {
        // Low density / safe: subtle dimmed grayscale background
        const lum = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
        dst[i] = Math.round(lum * 0.3);
        dst[i + 1] = Math.round(lum * 0.3);
        dst[i + 2] = Math.round(lum * 0.35);
        dst[i + 3] = 255;
      }
    }

    return heatmap;
  }
}
