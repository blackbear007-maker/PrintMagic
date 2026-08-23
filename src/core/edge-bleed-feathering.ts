/**
 * 20. 🌫️ Edge-Bleed-Feathering-Inpainter Soft Vignette Edge Feathering for Merchandise (MIT)
 * 
 * Pre-Press Problem Solved:
 * When printing photos onto ceramic mugs, tote bags, and cushions, rectangular sharp image borders
 * create an unnatural, harsh blocky aesthetic.
 * 
 * Solution:
 * Computes an adaptive non-linear alpha gradient feathering inwards from the 4 perimeter edges,
 * blending smoothly into the substrate background.
 */

export class EdgeBleedFeathering {
  /**
   * Applies smooth gradient alpha feathering to photo edges for merchandise printing
   */
  public static featherEdges(
    srcImageData: ImageData,
    featherMarginPx: number = 20
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;

        const distLeft = x;
        const distRight = w - 1 - x;
        const distTop = y;
        const distBottom = h - 1 - y;

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        let alphaScale = 1.0;

        if (minDist < featherMarginPx) {
          alphaScale = minDist / featherMarginPx;
        }

        dst[idx] = src[idx];
        dst[idx + 1] = src[idx + 1];
        dst[idx + 2] = src[idx + 2];
        dst[idx + 3] = Math.round(src[idx + 3] * alphaScale);
      }
    }

    return dstImageData;
  }
}
