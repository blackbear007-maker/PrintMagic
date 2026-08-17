/**
 * State-of-the-Art Multi-Stage Progressive Lanczos-3 Super-Resolution Engine (v3 Linear-Light)
 * Features:
 * 1. Physical Linear-Radiance Color Space Convolution (Zero dark halos on high-contrast edges)
 * 2. Multi-Stage Pyramid Scaling for 2x, 4x, 8x with minimal distortion
 * 3. Anti-Ringing & Overshoot Suppression (Halo Defense)
 * 4. Pre-computed 1024-step Kernel LUT + 256-step sRGB Linear LUT for ultra-fast performance
 */
export class LanczosResizer {
  private static readonly LOBES = 3;
  private static readonly LUT_SIZE = 1024;
  private static lut: Float32Array | null = null;

  // Precomputed 256-step sRGB to Linear table (100% optical radiance fidelity)
  private static readonly SRGB_TO_LINEAR: Float32Array = (() => {
    const table = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const v = i / 255;
      table[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return table;
  })();

  private static linearToSRgb(v: number): number {
    if (v <= 0) return 0;
    if (v >= 1) return 255;
    const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(s * 255)));
  }

  /**
   * Initializes or returns precomputed Lanczos-3 kernel lookup table
   */
  private static getLut(): Float32Array {
    if (this.lut) return this.lut;
    this.lut = new Float32Array(this.LUT_SIZE + 1);
    for (let i = 0; i <= this.LUT_SIZE; i++) {
      const x = (i / this.LUT_SIZE) * this.LOBES;
      this.lut[i] = this.calculateKernel(x);
    }
    return this.lut;
  }

  private static sinc(x: number): number {
    if (x === 0) return 1;
    const piX = Math.PI * x;
    return Math.sin(piX) / piX;
  }

  private static calculateKernel(x: number): number {
    const absX = Math.abs(x);
    if (absX === 0) return 1;
    if (absX >= this.LOBES) return 0;
    return this.sinc(x) * this.sinc(x / this.LOBES);
  }

  /**
   * Fast LUT kernel lookup
   */
  public static kernel(x: number): number {
    const absX = Math.abs(x);
    if (absX >= this.LOBES) return 0;
    const lut = this.getLut();
    // Clamp index strictly within [0, LUT_SIZE] to prevent boundary undefined access
    const idx = Math.min(this.LUT_SIZE, Math.round((absX / this.LOBES) * this.LUT_SIZE));
    return lut[idx];
  }

  /**
   * Main entry point: Multi-Stage Progressive Super-Resolution (Supports up to 8x Ultra HD)
   */
  public static resize(
    srcData: Uint8ClampedArray,
    srcWidth: number,
    srcHeight: number,
    scale: number
  ): { data: Uint8ClampedArray; width: number; height: number } {
    if (scale <= 1) {
      return {
        data: new Uint8ClampedArray(srcData),
        width: srcWidth,
        height: srcHeight
      };
    }

    // If scale > 2 (e.g. 4x or 8x), perform Progressive Pyramid Scaling
    if (scale > 2.2) {
      let currentData = srcData;
      let currentW = srcWidth;
      let currentH = srcHeight;
      let remainingScale = scale;

      while (remainingScale > 1.05) {
        const stepScale = remainingScale >= 2 ? 2 : remainingScale;
        const pass = this.singlePassResize(currentData, currentW, currentH, stepScale);
        currentData = pass.data;
        currentW = pass.width;
        currentH = pass.height;
        remainingScale /= stepScale;
      }

      return {
        data: currentData,
        width: currentW,
        height: currentH
      };
    }

    // Direct single pass for 1.1x ~ 2.2x
    return this.singlePassResize(srcData, srcWidth, srcHeight, scale);
  }

  /**
   * High-Precision Separable 2-Pass Lanczos-3 with Linear-Light Optical Resampling
   */
  private static singlePassResize(
    srcData: Uint8ClampedArray,
    srcWidth: number,
    srcHeight: number,
    scale: number
  ): { data: Uint8ClampedArray; width: number; height: number } {
    const dstWidth = Math.round(srcWidth * scale);
    const dstHeight = Math.round(srcHeight * scale);
    const lobes = this.LOBES;
    const toLinear = this.SRGB_TO_LINEAR;

    // Temporary buffer for horizontal pass (stores Linear-space floating point values)
    const tmp = new Float32Array(dstWidth * srcHeight * 4);
    const out = new Uint8ClampedArray(dstWidth * dstHeight * 4);

    // Pass 1: Horizontal Resize (in Linear-Radiance space)
    for (let y = 0; y < srcHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const center = (x + 0.5) / scale - 0.5;
        const xMin = Math.max(0, Math.floor(center - lobes));
        const xMax = Math.min(srcWidth - 1, Math.ceil(center + lobes));

        let totalWeight = 0;
        let r = 0, g = 0, b = 0, a = 0;

        let minR = 1, maxR = 0;
        let minG = 1, maxG = 0;
        let minB = 1, maxB = 0;

        for (let sx = xMin; sx <= xMax; sx++) {
          const weight = this.kernel(center - sx);
          if (weight === 0) continue;

          const idx = (y * srcWidth + sx) * 4;
          const linR = toLinear[srcData[idx]];
          const linG = toLinear[srcData[idx + 1]];
          const linB = toLinear[srcData[idx + 2]];
          const pa = srcData[idx + 3] / 255;

          // Local min/max for linear anti-ringing
          if (linR < minR) minR = linR;
          if (linR > maxR) maxR = linR;
          if (linG < minG) minG = linG;
          if (linG > maxG) maxG = linG;
          if (linB < minB) minB = linB;
          if (linB > maxB) maxB = linB;

          r += linR * weight;
          g += linG * weight;
          b += linB * weight;
          a += pa * weight;
          totalWeight += weight;
        }

        const dstIdx = (y * dstWidth + x) * 4;
        const norm = totalWeight !== 0 ? totalWeight : 1;

        // Apply Linear Anti-Ringing Clamping
        const rawR = r / norm;
        const rawG = g / norm;
        const rawB = b / norm;

        tmp[dstIdx]     = Math.min(maxR, Math.max(minR, rawR));
        tmp[dstIdx + 1] = Math.min(maxG, Math.max(minG, rawG));
        tmp[dstIdx + 2] = Math.min(maxB, Math.max(minB, rawB));
        tmp[dstIdx + 3] = a / norm;
      }
    }

    // Pass 2: Vertical Resize (Linear convolution + Gamma sRGB output packing)
    for (let y = 0; y < dstHeight; y++) {
      const center = (y + 0.5) / scale - 0.5;
      const yMin = Math.max(0, Math.floor(center - lobes));
      const yMax = Math.min(srcHeight - 1, Math.ceil(center + lobes));

      for (let x = 0; x < dstWidth; x++) {
        let totalWeight = 0;
        let r = 0, g = 0, b = 0, a = 0;

        let minR = 1, maxR = 0;
        let minG = 1, maxG = 0;
        let minB = 1, maxB = 0;

        for (let sy = yMin; sy <= yMax; sy++) {
          const weight = this.kernel(center - sy);
          if (weight === 0) continue;

          const idx = (sy * dstWidth + x) * 4;
          const pr = tmp[idx];
          const pg = tmp[idx + 1];
          const pb = tmp[idx + 2];
          const pa = tmp[idx + 3];

          if (pr < minR) minR = pr;
          if (pr > maxR) maxR = pr;
          if (pg < minG) minG = pg;
          if (pg > maxG) maxG = pg;
          if (pb < minB) minB = pb;
          if (pb > maxB) maxB = pb;

          r += pr * weight;
          g += pg * weight;
          b += pb * weight;
          a += pa * weight;
          totalWeight += weight;
        }

        const dstIdx = (y * dstWidth + x) * 4;
        const norm = totalWeight !== 0 ? totalWeight : 1;

        const rawR = r / norm;
        const rawG = g / norm;
        const rawB = b / norm;

        const clampedR = Math.min(maxR, Math.max(minR, rawR));
        const clampedG = Math.min(maxG, Math.max(minG, rawG));
        const clampedB = Math.min(maxB, Math.max(minB, rawB));

        // Final conversion from Linear-Radiance back to sRGB [0, 255]
        out[dstIdx]     = this.linearToSRgb(clampedR);
        out[dstIdx + 1] = this.linearToSRgb(clampedG);
        out[dstIdx + 2] = this.linearToSRgb(clampedB);
        out[dstIdx + 3] = Math.min(255, Math.max(0, Math.round((a / norm) * 255)));
      }
    }

    return {
      data: out,
      width: dstWidth,
      height: dstHeight
    };
  }
}
