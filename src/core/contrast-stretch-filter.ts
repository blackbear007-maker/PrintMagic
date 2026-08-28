/**
 * ⚙️ Power-Curve Contrast Stretch (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * A per-pixel power-curve (gamma-style) contrast stretch. It is not CLAHE (Contrast Limited
 * Adaptive Histogram Equalization) — real CLAHE operates on local tiles with per-tile histogram
 * clipping; this applies one global curve to the whole image, so it can't locally boost contrast
 * in one region without affecting the rest the same way.
 *
 * This file used to also export `detectAndDeskew()`, claiming Radon/Hough-transform skew
 * detection with "0.01° sub-pixel precision." It didn't detect anything — it always returned
 * `angle: 0`, `isSkewed: false`, and the untouched input image. It was also unreachable from any
 * UI or pipeline code (dead code, confirmed via repo-wide search). Removed rather than kept as a
 * convincing-looking no-op; a real deskew implementation is future work, not something to fake in
 * the meantime.
 */
import { createImageData } from './image-data-factory';

export class ContrastStretchFilter {
  /**
   * Applies a global power-curve contrast stretch
   */
  public static apply(
    srcImageData: ImageData,
    clipLimit: number = 2.5
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = createImageData(dstBuffer, w, h);
    const dst = dstImageData.data;

    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const normalizedLum = lum / 255.0;

      // S-curve contrast stretch with clip limit protection
      const stretched = Math.pow(normalizedLum, 1.0 / (1.0 + (clipLimit - 1.0) * 0.15)) * 255.0;
      const factor = lum > 0 ? stretched / lum : 1.0;

      dst[i] = Math.min(255, Math.max(0, Math.round(r * factor)));
      dst[i + 1] = Math.min(255, Math.max(0, Math.round(g * factor)));
      dst[i + 2] = Math.min(255, Math.max(0, Math.round(b * factor)));
      dst[i + 3] = src[i + 3];
    }

    return dstImageData;
  }
}
