/**
 * High-precision Lanczos-3 Image Interpolation Kernel
 * Produces crisp, artifact-free enlargement for physical print reproduction
 */
export class LanczosResizer {
  private static readonly LOBES = 3;

  /**
   * Sinc function sin(pi * x) / (pi * x)
   */
  private static sinc(x: number): number {
    if (x === 0) return 1;
    const piX = Math.PI * x;
    return Math.sin(piX) / piX;
  }

  /**
   * Lanczos-3 Windowed Kernel
   */
  public static kernel(x: number): number {
    const absX = Math.abs(x);
    if (absX === 0) return 1;
    if (absX >= this.LOBES) return 0;
    return this.sinc(x) * this.sinc(x / this.LOBES);
  }

  /**
   * Separable 2-Pass Lanczos-3 Resize
   */
  public static resize(
    srcData: Uint8ClampedArray,
    srcWidth: number,
    srcHeight: number,
    scale: number
  ): { data: Uint8ClampedArray; width: number; height: number } {
    if (scale === 1) {
      return {
        data: new Uint8ClampedArray(srcData),
        width: srcWidth,
        height: srcHeight
      };
    }

    const dstWidth = Math.round(srcWidth * scale);
    const dstHeight = Math.round(srcHeight * scale);
    const lobes = this.LOBES;

    // Temporary buffer for horizontal pass
    const tmp = new Float32Array(dstWidth * srcHeight * 4);
    const out = new Uint8ClampedArray(dstWidth * dstHeight * 4);

    // Pass 1: Horizontal Resize
    for (let y = 0; y < srcHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const center = (x + 0.5) / scale - 0.5;
        const xMin = Math.max(0, Math.floor(center - lobes));
        const xMax = Math.min(srcWidth - 1, Math.ceil(center + lobes));

        let totalWeight = 0;
        let r = 0, g = 0, b = 0, a = 0;

        for (let sx = xMin; sx <= xMax; sx++) {
          const weight = this.kernel(center - sx);
          if (weight === 0) continue;

          const idx = (y * srcWidth + sx) * 4;
          r += srcData[idx] * weight;
          g += srcData[idx + 1] * weight;
          b += srcData[idx + 2] * weight;
          a += srcData[idx + 3] * weight;
          totalWeight += weight;
        }

        const dstIdx = (y * dstWidth + x) * 4;
        const norm = totalWeight !== 0 ? totalWeight : 1;
        tmp[dstIdx] = r / norm;
        tmp[dstIdx + 1] = g / norm;
        tmp[dstIdx + 2] = b / norm;
        tmp[dstIdx + 3] = a / norm;
      }
    }

    // Pass 2: Vertical Resize
    for (let y = 0; y < dstHeight; y++) {
      const center = (y + 0.5) / scale - 0.5;
      const yMin = Math.max(0, Math.floor(center - lobes));
      const yMax = Math.min(srcHeight - 1, Math.ceil(center + lobes));

      for (let x = 0; x < dstWidth; x++) {
        let totalWeight = 0;
        let r = 0, g = 0, b = 0, a = 0;

        for (let sy = yMin; sy <= yMax; sy++) {
          const weight = this.kernel(center - sy);
          if (weight === 0) continue;

          const idx = (sy * dstWidth + x) * 4;
          r += tmp[idx] * weight;
          g += tmp[idx + 1] * weight;
          b += tmp[idx + 2] * weight;
          a += tmp[idx + 3] * weight;
          totalWeight += weight;
        }

        const dstIdx = (y * dstWidth + x) * 4;
        const norm = totalWeight !== 0 ? totalWeight : 1;
        out[dstIdx] = Math.min(255, Math.max(0, Math.round(r / norm)));
        out[dstIdx + 1] = Math.min(255, Math.max(0, Math.round(g / norm)));
        out[dstIdx + 2] = Math.min(255, Math.max(0, Math.round(b / norm)));
        out[dstIdx + 3] = Math.min(255, Math.max(0, Math.round(a / norm)));
      }
    }

    return {
      data: out,
      width: dstWidth,
      height: dstHeight
    };
  }
}
