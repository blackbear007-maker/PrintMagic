/**
 * ☀️ Grid-Interpolated Illumination Balancer (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * Samples background luminance on a 24x24 grid, then applies a bilinearly-interpolated per-pixel
 * gain to even out illumination. It is not a learned deshadowing network (no cross-attention, no
 * shadow-mask decomposition) — it is a local gain-map relighting heuristic, similar in spirit to
 * classical flat-field correction. Works on smooth, gradual shadows (phone/hand shadow on a
 * document); will not cleanly remove a hard-edged, high-contrast shadow.
 */

import { createImageData } from './image-data-factory';

export class HandShadowBalancer {
  /**
   * Automatically evens out phone/hand shadows from photos of artwork & documents
   */
  public static deshadow(
    srcImageData: ImageData,
    intensity: number = 0.85
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = createImageData(dstBuffer, w, h);
    const dst = dstImageData.data;

    // Spatial illumination sampling grid (up to 24x24). Blocks tile the whole image, so small
    // images or sizes not divisible by 24 don't leave unsampled cells or skew the interpolation.
    const gridCols = Math.max(1, Math.min(24, w));
    const gridRows = Math.max(1, Math.min(24, h));

    const illumGrid: number[][] = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let maxIllum = 0;

    // 1. Compute average background luminance per grid block
    for (let gy = 0; gy < gridRows; gy++) {
      const startY = Math.floor((gy * h) / gridRows);
      const endY = Math.max(startY + 1, Math.floor(((gy + 1) * h) / gridRows));
      for (let gx = 0; gx < gridCols; gx++) {
        const startX = Math.floor((gx * w) / gridCols);
        const endX = Math.max(startX + 1, Math.floor(((gx + 1) * w) / gridCols));
        let sumLum = 0;
        let count = 0;

        for (let py = startY; py < endY && py < h; py += 2) {
          for (let px = startX; px < endX && px < w; px += 2) {
            const idx = (py * w + px) * 4;
            const lum = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
            sumLum += lum;
            count++;
          }
        }

        // Every block has >=1 pixel now (gridCols<=w, gridRows<=h), so no fake 128 fill-in
        const avg = count > 0 ? sumLum / count : 0;
        illumGrid[gy][gx] = avg;
        if (avg > maxIllum) maxIllum = avg;
      }
    }

    // Content guard: this is meant for light documents/paper with a falloff shadow. If most
    // cells are not light background (median cell < 150), dark areas are content (night sky,
    // dark artwork) rather than shadow — leave the image untouched instead of relighting it.
    const cells = illumGrid.flat().sort((a, b) => a - b);
    if (cells[Math.floor(cells.length / 2)] < 150) {
      dst.set(src);
      return dstImageData;
    }

    if (maxIllum === 0) maxIllum = 255;

    // 2. Bilinearly-interpolated relighting gain field
    for (let y = 0; y < h; y++) {
      const gy = Math.min(gridRows - 1, Math.max(0, ((y + 0.5) / h) * gridRows - 0.5));
      const gy0 = Math.floor(gy);
      const gy1 = Math.min(gridRows - 1, gy0 + 1);
      const ty = gy - gy0;

      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const gx = Math.min(gridCols - 1, Math.max(0, ((x + 0.5) / w) * gridCols - 0.5));
        const gx0 = Math.floor(gx);
        const gx1 = Math.min(gridCols - 1, gx0 + 1);
        const tx = gx - gx0;

        // Bilinear local illumination estimation
        const i00 = illumGrid[gy0][gx0];
        const i10 = illumGrid[gy0][gx1];
        const i01 = illumGrid[gy1][gx0];
        const i11 = illumGrid[gy1][gx1];

        const localIllum = (i00 * (1 - tx) + i10 * tx) * (1 - ty) + (i01 * (1 - tx) + i11 * tx) * ty;

        // Adaptive gain factor with soft-knee rolloff to prevent highlight blowouts
        const targetRatio = maxIllum / Math.max(12, localIllum);
        const gain = Math.min(2.5, Math.pow(targetRatio, 0.82));
        const effectiveGain = 1.0 + (gain - 1.0) * intensity;

        dst[idx] = Math.min(255, Math.max(0, Math.round(src[idx] * effectiveGain)));
        dst[idx + 1] = Math.min(255, Math.max(0, Math.round(src[idx + 1] * effectiveGain)));
        dst[idx + 2] = Math.min(255, Math.max(0, Math.round(src[idx + 2] * effectiveGain)));
        dst[idx + 3] = src[idx + 3];
      }
    }

    return dstImageData;
  }
}
