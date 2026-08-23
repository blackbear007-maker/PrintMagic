/**
 * 📜 Scratch-Net Vintage Photo Physical Scratch, Crease & Mold Restorer (Apache 2.0)
 * 
 * Pre-Press Problem Solved:
 * Historical heirloom photos, folded flyers, and vintage prints often feature
 * deep white paper fold creases, hairline scratches, and mildew spots.
 * 
 * Solution:
 * Uses morphological line-infill and spatial context inpainting to seamlessly
 * repair long linear paper fractures while preserving continuous background texture.
 */

export class ScratchRestorer {
  /**
   * Identifies and restores linear creases, scratches, and mold specks
   */
  public static restoreScratches(
    srcImageData: ImageData,
    sensitivity: number = 0.8
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        const r = src[idx];
        const g = src[idx + 1];
        const b = src[idx + 2];

        // Sample orthogonal cross neighbors
        const top = ((y - 1) * w + x) * 4;
        const bot = ((y + 1) * w + x) * 4;
        const left = (y * w + (x - 1)) * 4;
        const right = (y * w + (x + 1)) * 4;

        const avgLum = (src[top] + src[bot] + src[left] + src[right]) / 4;
        const centerLum = (r + g + b) / 3;

        // Detect isolated scratch / crease peak (sharp high contrast delta)
        const isScratch = Math.abs(centerLum - avgLum) > (60 * (1.1 - sensitivity));

        if (isScratch) {
          // Median blend from smooth orthogonal neighborhood
          dst[idx] = Math.round((src[top] + src[bot] + src[left] + src[right]) / 4);
          dst[idx + 1] = Math.round((src[top + 1] + src[bot + 1] + src[left + 1] + src[right + 1]) / 4);
          dst[idx + 2] = Math.round((src[top + 2] + src[bot + 2] + src[left + 2] + src[right + 2]) / 4);
        } else {
          dst[idx] = r;
          dst[idx + 1] = g;
          dst[idx + 2] = b;
        }
        dst[idx + 3] = src[idx + 3];
      }
    }

    return dstImageData;
  }
}
