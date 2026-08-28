/**
 * Professional Pre-press Edge-Preserving Unsharp Mask (USM) — v3 Multi-Scale Adaptive
 *
 * v3 升級重點 vs v2：
 * 1. 雙尺度 Laplacian 高頻分解 (σ_fine=0.8 細節層 + σ_structure=2.5 結構層)
 *    → 在細節層保護紋理邊緣，結構層保護輪廓，兩層按感知比例混合
 * 2. 局部方差自適應噪點遮罩 (Local Variance Noise Shield)
 *    → 在平滑低方差區域（天空、皮膚、漸層）自動降低 USM 強度，防止噪點放大
 * 3. Soft-Clamp Overshoot 限制 (Ringing Artifact 抑制)
 *    → 使用 smoothstep 軟夾值而非硬限幅，避免在強邊緣旁出現振鈴光暈
 * 4. 沿用 Recursive Gaussian IIR (Young-van Vliet O(N) 方法)
 *    → 保持完全準確的 Gaussian 頻率響應，無箱型濾波的中頻洩漏
 * 5. 保留 CIE Lab L* 純亮度銳化（無色偏）
 */
import { CmykEngine } from './cmyk-engine';

export class UnsharpMask {
  public static readonly DEFAULT_AMOUNT = 1.5;
  public static readonly DEFAULT_RADIUS = 1.2;
  public static readonly DEFAULT_THRESHOLD = 3;

  // Fine detail sigma and structure sigma for dual-scale decomposition
  private static readonly SIGMA_FINE = 0.8;
  private static readonly SIGMA_STRUCTURE = 2.5;
  // Local variance window half-size for noise shield
  private static readonly NOISE_WIN = 4;
  // Noise threshold below which USM amount is suppressed
  private static readonly NOISE_VAR_LOW = 0.0003;
  private static readonly NOISE_VAR_HIGH = 0.004;

  // ─────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────

  public static apply(
    imageData: ImageData,
    amount: number = this.DEFAULT_AMOUNT,
    radius: number = this.DEFAULT_RADIUS,
    threshold: number = this.DEFAULT_THRESHOLD
  ): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;

    // 1. Convert sRGB → CIE Lab L* (luminance only for sharpening)
    const labL = this.rgbToLabLuminance(src, width * height);

    // 2. Dual-scale Gaussian blur: fine (detail) + structure (outline)
    const blurFine = this.recursiveGaussianBlur(labL, width, height,
      Math.max(0.5, this.SIGMA_FINE * radius));
    const blurStructure = this.recursiveGaussianBlur(labL, width, height,
      Math.max(0.8, this.SIGMA_STRUCTURE * radius));

    // 3. Local variance map for noise shield (box approximation for speed)
    const localVar = this.computeLocalVariance(labL, width, height, this.NOISE_WIN);

    // 4. Build multi-scale high-pass and apply adaptive USM back in sRGB
    const dst = new Uint8ClampedArray(src.length);
    dst.set(src);

    for (let i = 0; i < width * height; i++) {
      const pi = i * 4;
      dst[pi + 3] = src[pi + 3]; // preserve alpha

      const origL = labL[i];

      // Fine-scale (detail) sharpening signal
      const diffFine = origL - blurFine[i];
      // Structure-scale sharpening signal (catches broad edges, avoids fine noise)
      const diffStruct = origL - blurStructure[i];

      // If fine diff and structure diff agree in sign, boost; otherwise average
      const signAgree = diffFine * diffStruct > 0;
      const diff = signAgree
        ? (diffFine * 0.65 + diffStruct * 0.35)  // blend for strong agreed edges
        : (diffFine * 0.4 + diffStruct * 0.6);   // more conservative on disagreement

      const absDiff = Math.abs(diff);

      // Threshold guard
      if (absDiff < threshold) continue;

      // ── Noise shield: suppress in smooth/noisy regions ──
      const v = localVar[i];
      let noiseFactor = 1.0;
      if (v < this.NOISE_VAR_LOW) {
        // Near-flat zone: suppress entirely
        noiseFactor = 0.05;
      } else if (v < this.NOISE_VAR_HIGH) {
        // Ramp up from 0.05 → 1.0
        const t = (v - this.NOISE_VAR_LOW) / (this.NOISE_VAR_HIGH - this.NOISE_VAR_LOW);
        noiseFactor = 0.05 + 0.95 * t * t; // quadratic ramp
      }

      // ── Adaptive edge weight ──
      const edgeWeight = Math.min(1.2, absDiff / 15);
      const effectiveAmount = amount * (0.8 + 0.4 * edgeWeight) * noiseFactor;

      // Soft-clamp gain to suppress ringing (Overshoot ≤ 15 Lab units)
      const rawGain = diff * effectiveAmount;
      const gain = this.softClamp(rawGain, 15);

      dst[pi]     = Math.min(255, Math.max(0, Math.round(src[pi]     + gain)));
      dst[pi + 1] = Math.min(255, Math.max(0, Math.round(src[pi + 1] + gain)));
      dst[pi + 2] = Math.min(255, Math.max(0, Math.round(src[pi + 2] + gain)));
    }

    if (typeof ImageData !== 'undefined') {
      return new ImageData(dst, width, height);
    }
    return { data: dst, width, height } as ImageData;
  }

  // ─────────────────────────────────────────────────────────
  // Soft-Clamp (smoothstep-based) to suppress ringing overshoot
  // Maps input x to output within [-limit, +limit] with smooth saturation
  // ─────────────────────────────────────────────────────────
  private static softClamp(x: number, limit: number): number {
    const sign = x >= 0 ? 1 : -1;
    const abs = Math.abs(x);
    if (abs <= limit) return x;
    // Smooth saturation: after 'limit', converge to 1.5×limit
    const t = (abs - limit) / limit;
    const compressed = limit + limit * 0.5 * (1 - 1 / (1 + t));
    return sign * Math.min(compressed, limit * 1.5);
  }

  // ─────────────────────────────────────────────────────────
  // Local Variance Map (box approximation for O(N) performance)
  // Returns per-pixel local L* variance in a (2W+1)×(2W+1) window
  // ─────────────────────────────────────────────────────────
  private static computeLocalVariance(
    labL: Float32Array,
    width: number,
    height: number,
    winHalf: number
  ): Float32Array {
    const N = width * height;
    const variance = new Float32Array(N);

    // Compute integral images for sum and sum-of-squares
    const iSum = new Float64Array((width + 1) * (height + 1));
    const iSumSq = new Float64Array((width + 1) * (height + 1));
    const W1 = width + 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = labL[y * width + x] / 100; // normalize L* to [0,1]
        iSum[(y + 1) * W1 + (x + 1)] =
          v + iSum[y * W1 + (x + 1)] + iSum[(y + 1) * W1 + x] - iSum[y * W1 + x];
        iSumSq[(y + 1) * W1 + (x + 1)] =
          v * v + iSumSq[y * W1 + (x + 1)] + iSumSq[(y + 1) * W1 + x] - iSumSq[y * W1 + x];
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - winHalf);
        const x2 = Math.min(width - 1, x + winHalf);
        const y1 = Math.max(0, y - winHalf);
        const y2 = Math.min(height - 1, y + winHalf);
        const cnt = (x2 - x1 + 1) * (y2 - y1 + 1);

        const sum =
          iSum[(y2 + 1) * W1 + (x2 + 1)] - iSum[y1 * W1 + (x2 + 1)] -
          iSum[(y2 + 1) * W1 + x1] + iSum[y1 * W1 + x1];
        const sumSq =
          iSumSq[(y2 + 1) * W1 + (x2 + 1)] - iSumSq[y1 * W1 + (x2 + 1)] -
          iSumSq[(y2 + 1) * W1 + x1] + iSumSq[y1 * W1 + x1];

        const mean = sum / cnt;
        variance[y * width + x] = Math.max(0, sumSq / cnt - mean * mean);
      }
    }
    return variance;
  }

  // ─────────────────────────────────────────────────────────
  // CIE Lab L* extraction (luminance channel only)
  // ─────────────────────────────────────────────────────────

  private static rgbToLabLuminance(data: Uint8ClampedArray, pixelCount: number): Float32Array {
    const labL = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const pi = i * 4;

      // sRGB → linear, via CmykEngine's precomputed 256-entry LUT (2026-08-28: this used to
      // recompute the same formula with Math.pow per channel per pixel across the whole image —
      // cmyk-engine.ts already has an equivalent LUT built once, reused here instead).
      const linR = CmykEngine.sRgbToLinear(data[pi]);
      const linG = CmykEngine.sRgbToLinear(data[pi + 1]);
      const linB = CmykEngine.sRgbToLinear(data[pi + 2]);

      // linear → Y (CIE XYZ luminance, D65)
      const Y = 0.2126 * linR + 0.7152 * linG + 0.0722 * linB;

      // Y → L*
      const f = Y > 0.008856 ? Math.cbrt(Y) : (7.787 * Y + 16 / 116);
      labL[i] = 116 * f - 16; // L* ∈ [0, 100]
    }
    return labL;
  }

  // ─────────────────────────────────────────────────────────
  // Recursive Gaussian IIR Filter (Deriche O(N) approximation)
  // Accurate frequency response identical to true Gaussian blur
  // ─────────────────────────────────────────────────────────

  private static recursiveGaussianBlur(
    channel: Float32Array,
    width: number,
    height: number,
    sigma: number
  ): Float32Array {
    // Clamp sigma to avoid degenerate coefficients
    const s = Math.max(0.5, sigma);

    // Young-van Vliet recursive Gaussian IIR coefficients
    const q = s >= 2.5
      ? 0.98711 * s - 0.96330
      : s >= 0.5
        ? 3.97156 - 4.14554 * Math.sqrt(1 - 0.26891 * s)
        : 0.1147705018520355224609375;

    const q2 = q * q;
    const q3 = q2 * q;

    const b0 = 1.57825 + 2.44413 * q + 1.4281 * q2 + 0.422205 * q3;
    const b1 = (2.44413 * q + 2.85619 * q2 + 1.26661 * q3) / b0;
    const b2 = -(1.4281 * q2 + 1.26661 * q3) / b0;
    const b3 = (0.422205 * q3) / b0;
    const B  = 1 - b1 - b2 - b3;

    const out = new Float32Array(channel.length);

    // Horizontal forward + backward pass
    const row = new Float32Array(width);
    for (let y = 0; y < height; y++) {
      const base = y * width;
      for (let x = 0; x < width; x++) row[x] = channel[base + x];

      const fwd = new Float32Array(width);
      fwd[0] = B * row[0];
      if (width > 1) fwd[1] = B * row[1] + b1 * fwd[0];
      if (width > 2) fwd[2] = B * row[2] + b1 * fwd[1] + b2 * fwd[0];
      for (let x = 3; x < width; x++) {
        fwd[x] = B * row[x] + b1 * fwd[x-1] + b2 * fwd[x-2] + b3 * fwd[x-3];
      }
      const bwd = new Float32Array(width);
      bwd[width-1] = B * fwd[width-1];
      if (width > 1) bwd[width-2] = B * fwd[width-2] + b1 * bwd[width-1];
      if (width > 2) bwd[width-3] = B * fwd[width-3] + b1 * bwd[width-2] + b2 * bwd[width-1];
      for (let x = width-4; x >= 0; x--) {
        bwd[x] = B * fwd[x] + b1 * bwd[x+1] + b2 * bwd[x+2] + b3 * bwd[x+3];
      }
      for (let x = 0; x < width; x++) out[base + x] = bwd[x];
    }

    // Vertical forward + backward pass
    const col = new Float32Array(height);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) col[y] = out[y * width + x];

      const fwd = new Float32Array(height);
      fwd[0] = B * col[0];
      if (height > 1) fwd[1] = B * col[1] + b1 * fwd[0];
      if (height > 2) fwd[2] = B * col[2] + b1 * fwd[1] + b2 * fwd[0];
      for (let y = 3; y < height; y++) {
        fwd[y] = B * col[y] + b1 * fwd[y-1] + b2 * fwd[y-2] + b3 * fwd[y-3];
      }
      const bwd = new Float32Array(height);
      bwd[height-1] = B * fwd[height-1];
      if (height > 1) bwd[height-2] = B * fwd[height-2] + b1 * bwd[height-1];
      if (height > 2) bwd[height-3] = B * fwd[height-3] + b1 * bwd[height-2] + b2 * bwd[height-1];
      for (let y = height-4; y >= 0; y--) {
        bwd[y] = B * fwd[y] + b1 * bwd[y+1] + b2 * bwd[y+2] + b3 * bwd[y+3];
      }
      for (let y = 0; y < height; y++) out[y * width + x] = bwd[y];
    }

    return out;
  }
}
