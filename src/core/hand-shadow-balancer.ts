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
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Spatial illumination sampling grid (24x24)
    const gridCols = 24;
    const gridRows = 24;
    const blockW = Math.max(1, Math.floor(w / gridCols));
    const blockH = Math.max(1, Math.floor(h / gridRows));

    const illumGrid: number[][] = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let maxIllum = 0;

    // 1. Compute average background luminance per grid block
    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        const startX = gx * blockW;
        const startY = gy * blockH;
        let sumLum = 0;
        let count = 0;

        for (let dy = 0; dy < blockH; dy += 2) {
          const py = startY + dy;
          if (py >= h) break;
          for (let dx = 0; dx < blockW; dx += 2) {
            const px = startX + dx;
            if (px >= w) break;
            const idx = (py * w + px) * 4;
            const lum = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
            sumLum += lum;
            count++;
          }
        }

        const avg = count > 0 ? sumLum / count : 128;
        illumGrid[gy][gx] = avg;
        if (avg > maxIllum) maxIllum = avg;
      }
    }

    if (maxIllum === 0) maxIllum = 255;

    // 2. Bilinearly-interpolated relighting gain field
    for (let y = 0; y < h; y++) {
      const gy = (y / h) * (gridRows - 1);
      const gy0 = Math.floor(gy);
      const gy1 = Math.min(gridRows - 1, gy0 + 1);
      const ty = gy - gy0;

      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const gx = (x / w) * (gridCols - 1);
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
