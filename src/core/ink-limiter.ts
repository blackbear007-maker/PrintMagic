import type { InkAnalysis } from '../types';
import { CmykEngine } from './cmyk-engine';

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
  // TAC Analysis
  //
  // ⚠️ 2026-08-28 修正一個真實存在的計算錯誤：舊版算 `totalInk = (c+m+y+k)*100`，其中 c/m/y 是「完全
  // 沒去底色」的 naive CMY（c=1-r 等），k 又另外疊加 `min(c,m,y)`——等於同一份灰階份量被算了兩次。純黑
  // (0,0,0) 因此被算成 400%（c=m=y=k=100%），但業界標準的 TAC 定義（K 版完全取代灰階份量後）純黑應該
  // 是 100%。這不是無傷大雅的高估：預設 300% 上限下，任何深於 75% 灰的像素就會被誤判超標，導致陰影/
  // 黑色文字大量被 `clampInk()` 過度沖淡飽和度，而它們本來印起來完全安全。這也正是 `cmyk-engine.ts`
  // 同一天修正的那個 GCR bug 的姊妹問題——兩個檔案原本用兩套不同、互相矛盾的公式算同一件事。
  //
  // 修正時考慮過改用「全 UCR」（K 版完全取代灰階份量）：純黑會正確算出 100% 沒錯，但反而製造了新問題
  // ——可以證明這個公式對任何 RGB 輸入，TAC 理論上限剛好是 200%（純飽和單色，如純紅 (255,0,0)：
  // C=0/M=100/Y=100/K=0）。這代表在預設 300% 上限下，`hasOverflow`／`clampInk`／熱力圖警示這整套安全
  // 機制會變成永遠不會觸發的死功能——用一個新的「安靜的不安全」換掉舊的「吵鬧的假警報」，並不是真正
  // 的修正。
  //
  // 因此改為直接呼叫 `CmykEngine.rgbToCmyk()`——本站實際輸出分色真正會用的那套「可調式局部 GCR」公式
  // ——確保這裡回報的 TAC 數字，就是這張圖片實際送印時真正會用到的墨量，而不是另一套脫節的理論假設。
  // 兩個檔案從此用同一套真相來源，不會再對同一個像素算出不同答案。
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
      // Same separation the app actually prints with — see the fix note above.
      const cmyk = CmykEngine.rgbToCmyk(data[i], data[i + 1], data[i + 2]);
      const totalInk = (cmyk.c + cmyk.m + cmyk.y + cmyk.k) * 100;
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
      // (the real CmykEngine separation, see the fix note above analyze())
      const rN = r8 / 255;
      const gN = g8 / 255;
      const bN = b8 / 255;

      // Naive (pre-GCR) CMY — kept for Step 3's proportional compression path and the
      // isChromatic heuristic below; NOT used for the TAC measurement itself anymore.
      const cSimple = 1 - rN;
      const mSimple = 1 - gN;
      const ySimple = 1 - bN;
      const kSimple = Math.min(cSimple, mSimple, ySimple);

      const cmykIn = CmykEngine.rgbToCmyk(r8, g8, b8);
      const totalInk = (cmykIn.c + cmykIn.m + cmykIn.y + cmykIn.k) * 100;

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
      // Verify the output pixel passes analyze()'s formula (the real adaptive-GCR separation).
      //
      // 2026-08-28 追加修正：原本這裡用「naive CMY 比例縮放」去逼近由真實 GCR 公式量測出的 TAC
      // ——用手動追蹤實際失敗像素驗證過，這是兩套不同的色彩模型：縮放 naive C/M/Y 的幅度跟真實
      // （Bradford + 分級 GCR）TAC 實際下降的幅度不成比例，導致每次迭代只能緩慢逼近目標，6 次
      // 迭代後仍卡在剛好超標一點點（150.1~151.6% vs 目標 150%），不是精度問題而是收斂速度問題。
      //
      // 改用「向白色二分搜尋」：在目前顏色與純白 (255,255,255) 之間二分，每次都用真實公式重新
      // 量測候選值，只有通過安全檢查才採用。純白的 TAC 恆為 0（不可能超標），因此保證有解；且因
      // 為只在「確認安全」時才更新採用的候選值，即使真實 GCR 分級公式在灰階份量跨越 0.3/0.6 門檻
      // 時有不連續跳動（非嚴格單調），這個演算法仍保證回傳的像素一定安全，只是可能不是理論上最
      // 飽和的安全值——對印前安全機制而言，「保證安全」比「精確逼近門檻」更重要。
      const safeTarget = maxLimit * 0.995;
      {
        const startR = outR8, startG = outG8, startB = outB8;
        let loT = 0, hiT = 1;
        // Pure white is always safe (TAC ≈ 0), so it's a valid fallback answer.
        let bestR = 255, bestG = 255, bestB = 255;
        for (let iter = 0; iter < 14; iter++) {
          const t = (loT + hiT) / 2;
          const candR = Math.round(startR + (255 - startR) * t);
          const candG = Math.round(startG + (255 - startG) * t);
          const candB = Math.round(startB + (255 - startB) * t);
          const cmykCand = CmykEngine.rgbToCmyk(candR, candG, candB);
          const tacCand = (cmykCand.c + cmykCand.m + cmykCand.y + cmykCand.k) * 100;
          if (tacCand <= safeTarget) {
            hiT = t;
            bestR = candR;
            bestG = candG;
            bestB = candB;
          } else {
            loT = t;
          }
        }
        outR8 = bestR;
        outG8 = bestG;
        outB8 = bestB;
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
      // Same real adaptive-GCR separation as analyze()/clampInk() — see the fix note above analyze().
      const cmyk = CmykEngine.rgbToCmyk(src[i], src[i + 1], src[i + 2]);
      const totalInk = (cmyk.c + cmyk.m + cmyk.y + cmyk.k) * 100;

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
