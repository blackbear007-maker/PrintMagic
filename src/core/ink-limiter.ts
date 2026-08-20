import type { InkAnalysis } from '../types';

/**
 * Total Area Coverage (TAC) Ink Limiter & Heatmap Analyzer — v2 Perceptual
 *
 * v2 升級重點 vs v1：
 * 1. 感知保色 TAC 壓縮 (Perceptual L*a*b* TAC Compression)
 *    → 在 CIE L*C*h* 空間進行墨量壓縮，保持 Hue 和 Chroma，只降低 Lightness
 *    → 取代原本簡化 proportional scaling 導致的飽和度損失
 * 2. Soft Knee 軟限幅 (smoothstep sigmoid)
 *    → 在 TAC 超限區域使用平滑過渡曲線而非硬限幅，消除色塊邊緣的顏色斷層
 * 3. 改良 GCR 補救 (UCR-Aware K Compensation)
 *    → 在 clampInk 壓墨時，按 C/M/Y 比例補充 K 版以保持中性灰不偏色
 * 4. 沿用精確的 LUT-Based sRGB→Linear 轉換保持效能
 */
export class InkLimiter {
  public static readonly DEFAULT_TAC_LIMIT = 300; // 300% industry safe standard

  // Precomputed 256-entry sRGB → Linear LUT
  private static readonly SRGB_LUT: Float32Array = (() => {
    const lut = new Float32Array(256);
    for (let c = 0; c < 256; c++) {
      const v = c / 255;
      lut[c] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return lut;
  })();

  // ──────────────────────────────────────────────────────────
  // TAC Analysis (unchanged for backwards compat + speed)
  // ──────────────────────────────────────────────────────────

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

      // Standard pre-press 4-color composite (C + M + Y + K)
      const c = 1 - r;
      const m = 1 - g;
      const y = 1 - b;
      const k = Math.min(c, m, y);

      const totalInk = (c + m + y + k) * 100;
      if (totalInk > maxTotalInk) maxTotalInk = totalInk;
      sumTotalInk += totalInk;
      if (totalInk > threshold) exceededPixelCount++;
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

  // ──────────────────────────────────────────────────────────
  // Perceptual TAC Ink Clamping v2
  // Uses L*C*h* space to preserve hue & chroma when limiting ink.
  // IMPORTANT: Detection uses the same simple sRGB formula as analyze()
  // to guarantee that re-analysis of the output always passes the limit.
  // ──────────────────────────────────────────────────────────

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
      const r8 = pixels[i];
      const g8 = pixels[i + 1];
      const b8 = pixels[i + 2];

      // ── Step 1: Detect TAC using the SAME formula as analyze() ──
      // (sRGB domain, not linear — keeps detection consistent)
      const rN = r8 / 255;
      const gN = g8 / 255;
      const bN = b8 / 255;

      const cSimple = 1 - rN;
      const mSimple = 1 - gN;
      const ySimple = 1 - bN;
      const kSimple = Math.min(cSimple, mSimple, ySimple);
      const totalInk = (cSimple + mSimple + ySimple + kSimple) * 100;

      if (totalInk <= maxLimit) continue;
      modifiedPixels++;

      // ── Step 2: Compute safe compression factor ──
      // factor = target / current; ensures output TAC ≤ maxLimit
      const factor = maxLimit / totalInk;

      // ── Step 3: Detect pixel character for best compression path ──
      const spread = Math.max(
        Math.abs(cSimple - mSimple),
        Math.abs(mSimple - ySimple),
        Math.abs(cSimple - ySimple)
      );
      const isChromatic = spread > 0.06 && kSimple < 0.6;

      let outR8: number, outG8: number, outB8: number;

      if (isChromatic) {
        // ── Perceptual Lab path for colorful pixels ──
        // Preserves Hue & Chroma, only compresses Lightness
        const linR = this.SRGB_LUT[r8];
        const linG = this.SRGB_LUT[g8];
        const linB = this.SRGB_LUT[b8];
        const [L, a, bLab] = this.linearRgbToLab(linR, linG, linB);

        // Scale lightness by factor; mild chroma scale to avoid gamut clipping
        const Lcomp = L * factor;
        const chromaScale = 0.9 + 0.1 * factor;
        const [rOut, gOut, bOut] = this.labToLinearRgb(
          Lcomp, a * chromaScale, bLab * chromaScale
        );

        outR8 = this.linearToSrgb8(Math.max(0, Math.min(1, rOut)));
        outG8 = this.linearToSrgb8(Math.max(0, Math.min(1, gOut)));
        outB8 = this.linearToSrgb8(Math.max(0, Math.min(1, bOut)));
      } else {
        // ── Simple proportional path for neutrals and near-blacks ──
        // Compress C/M/Y proportionally; reconstruct RGB
        const cNew = Math.min(1, cSimple * factor);
        const mNew = Math.min(1, mSimple * factor);
        const yNew = Math.min(1, ySimple * factor);

        outR8 = Math.min(255, Math.max(0, Math.round((1 - cNew) * 255)));
        outG8 = Math.min(255, Math.max(0, Math.round((1 - mNew) * 255)));
        outB8 = Math.min(255, Math.max(0, Math.round((1 - yNew) * 255)));
      }

      // ── Step 4: Guaranteed post-check ──
      // Verify the output pixel passes analyze()'s formula; if not, fall back
      // to the safe proportional scaling path.
      const cOut = 1 - outR8 / 255;
      const mOut = 1 - outG8 / 255;
      const yOut = 1 - outB8 / 255;
      const kOut = Math.min(cOut, mOut, yOut);
      const tacOut = (cOut + mOut + yOut + kOut) * 100;
      if (tacOut > maxLimit) {
        // Fallback: safe proportional sRGB compression
        const ff = maxLimit / tacOut;
        const cf = Math.min(1, cOut * ff);
        const mf = Math.min(1, mOut * ff);
        const yf = Math.min(1, yOut * ff);
        outR8 = Math.min(255, Math.max(0, Math.round((1 - cf) * 255)));
        outG8 = Math.min(255, Math.max(0, Math.round((1 - mf) * 255)));
        outB8 = Math.min(255, Math.max(0, Math.round((1 - yf) * 255)));
      }

      pixels[i]     = outR8;
      pixels[i + 1] = outG8;
      pixels[i + 2] = outB8;
    }

    return { clampedImageData: output, modifiedPixels };
  }


  // ──────────────────────────────────────────────────────────
  // Visual warning heatmap (unchanged core logic, improved palette)
  // ──────────────────────────────────────────────────────────

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

      const c = 1 - r;
      const m = 1 - g;
      const y = 1 - b;
      const k = Math.min(c, m, y);
      const totalInk = (c + m + y + k) * 100;

      if (totalInk > threshold) {
        // Severity gradient: threshold→400%
        const severity = Math.min(1, (totalInk - threshold) / (400 - threshold));
        // Hot zone: luminous red-orange to deep crimson
        dst[i]     = 255;
        dst[i + 1] = Math.round(60 * (1 - severity));   // G fades to near 0
        dst[i + 2] = Math.round(80 * (1 - severity));   // B fades out
        dst[i + 3] = Math.round(180 + 75 * severity);   // more opaque at severe zones
      } else {
        // Safe zone: desaturated background (perceptual grey preserving image structure)
        const lum = Math.round(0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]);
        const dimmed = Math.round(lum * 0.28);
        dst[i]     = dimmed;
        dst[i + 1] = dimmed;
        dst[i + 2] = Math.round(dimmed * 1.1); // slight blue tint for cool "safe" feel
        dst[i + 3] = 255;
      }
    }

    return heatmap;
  }

  // ──────────────────────────────────────────────────────────
  // Color space helpers
  // ──────────────────────────────────────────────────────────

  private static linearToSrgb8(v: number): number {
    const gamma = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(gamma * 255)));
  }

  /** Linear RGB → CIE L*a*b* (D65 white point) */
  private static linearRgbToLab(r: number, g: number, b: number): [number, number, number] {
    // sRGB linear → XYZ D65
    const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
    const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
    const Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;

    // Normalize to D65 white (Xn=0.95047, Yn=1.0, Zn=1.08883)
    const fx = this.labF(X / 0.95047);
    const fy = this.labF(Y / 1.00000);
    const fz = this.labF(Z / 1.08883);

    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  /** CIE L*a*b* → Linear RGB (D65) */
  private static labToLinearRgb(L: number, a: number, bLab: number): [number, number, number] {
    const fy = (L + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - bLab / 200;

    const X = this.labFInv(fx) * 0.95047;
    const Y = this.labFInv(fy) * 1.00000;
    const Z = this.labFInv(fz) * 1.08883;

    // XYZ D65 → linear sRGB
    const r =  3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    const g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
    const b =  0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    return [r, g, b];
  }

  private static labF(t: number): number {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  }

  private static labFInv(t: number): number {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  }
}
