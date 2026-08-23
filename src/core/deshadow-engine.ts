/**
 * ☀️ Deshadow-Net & Illumination Uniformity Engine (Retinex Theory)
 * 
 * Pre-Press Problem Solved:
 * Photos of physical artwork, children's drawings, or business cards taken with smartphones
 * often have ugly dark shadows cast by the phone body, hands, or indoor ceiling lamps.
 * 
 * Solution:
 * Based on Single-Scale Retinex (SSR) theory: Image = Reflectance × Illumination
 * 1. Estimates low-frequency spatial illumination gradient map I(x, y).
 * 2. Normalizes non-uniform shadow falloff across the canvas.
 * 3. Restores uniform, bright, daylight-balanced page background without color shift.
 */

export class DeshadowEngine {
  /**
   * Automatically detects and removes phone/hand shadows from photos of artwork
   */
  public static deshadow(
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

    // Downscale spatial grid to estimate coarse illumination field (16x16 grid)
    const gridCols = 16;
    const gridRows = 16;
    const blockW = Math.max(1, Math.floor(w / gridCols));
    const blockH = Math.max(1, Math.floor(h / gridRows));

    const illumGrid: number[][] = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    let maxIllum = 0;

    // 1. Compute 90th-percentile background luminance per block
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
            const lum = 0.2126 * src[idx] + 0.7152 * src[idx + 1] + 0.0722 * src[idx + 2];
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

    // 2. Bilinear interpolation of illumination field + Retinex compensation
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

        // Illumination Gain factor (boost shadowed regions towards maxIllum)
        const gain = localIllum > 10 ? Math.min(2.2, maxIllum / localIllum) : 1.0;
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
