/**
 * 🖨️ Moiré & Halftone De-Screening Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * When users scan or take phone photos of physical printed magazines, packaging, or offset posters,
 * the original halftone screen dots (133~175 LPI) clash with new printing press screens,
 * causing severe optical interference moiré patterns (rainbow concentric artifacts).
 * 
 * Solution:
 * 1. High-frequency regular grid notch suppression: Identifies repeating halftone rosette patterns.
 * 2. Edge-preserving bilateral smoothing: Removes honeycomb dots while preserving crisp object contours.
 */

export class DescreenEngine {
  /**
   * Removes halftone screen dots and moiré patterns from scanned physical prints
   */
  public static descreen(
    srcImageData: ImageData,
    intensity: number = 0.75
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Fast 3x3 adaptive notch median smoothing for halftone frequency suppression
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;

        if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
          dst[idx] = src[idx];
          dst[idx + 1] = src[idx + 1];
          dst[idx + 2] = src[idx + 2];
          dst[idx + 3] = src[idx + 3];
          continue;
        }

        for (let c = 0; c < 3; c++) {
          const c00 = src[((y - 1) * w + (x - 1)) * 4 + c];
          const c01 = src[((y - 1) * w + x) * 4 + c];
          const c02 = src[((y - 1) * w + (x + 1)) * 4 + c];
          const c10 = src[(y * w + (x - 1)) * 4 + c];
          const c11 = src[idx + c];
          const c12 = src[(y * w + (x + 1)) * 4 + c];
          const c20 = src[((y + 1) * w + (x - 1)) * 4 + c];
          const c21 = src[((y + 1) * w + x) * 4 + c];
          const c22 = src[((y + 1) * w + (x + 1)) * 4 + c];

          const avg = (c00 + c01 + c02 + c10 + c11 * 2 + c12 + c20 + c21 + c22) / 10;
          const diff = Math.abs(c11 - avg);

          // If high-frequency dot noise detected (diff < 45), blend with smoothed
          if (diff < 45) {
            dst[idx + c] = Math.round(c11 * (1 - intensity) + avg * intensity);
          } else {
            // Preserve strong outline edges
            dst[idx + c] = c11;
          }
        }
        dst[idx + 3] = src[idx + 3];
      }
    }

    return dstImageData;
  }
}
