/**
 * 15. ✨ Foiling-Highlight-Extractor 1-Click Gold/Silver Hot Stamping Mask Extractor (MIT)
 * 
 * Pre-Press Problem Solved:
 * Creating wedding invitations or luxury business cards with hot stamping (燙金/燙銀) requires
 * extracting title text or gold accents onto an isolated 100% K100 binary mask for zinc block CNC etching.
 * 
 * Solution:
 * Uses color-range chroma gating to isolate gold, copper, and bright accents into a clean 100% K100 plate.
 */

export class FoilingHighlightExtractor {
  /**
   * Extracts gold/silver highlight areas into an isolated 100% K100 hot stamping mask
   */
  public static extractFoilingMask(
    srcImageData: ImageData,
    targetMode: 'gold' | 'silver' | 'all-bright' = 'gold'
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const a = src[i + 3];

      let isFoil = false;

      if (targetMode === 'gold') {
        // Gold: High Red, Medium-High Green, Low Blue (Yellow/Gold Hue)
        if (r > 160 && g > 120 && b < 100 && r > b) {
          isFoil = true;
        }
      } else if (targetMode === 'silver') {
        // Silver: High luminance with near-zero chroma
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const diff = Math.max(Math.abs(r - g), Math.abs(g - b));
        if (lum > 180 && diff < 20) {
          isFoil = true;
        }
      } else {
        if (r > 200 || g > 200 || b > 200) isFoil = true;
      }

      if (isFoil && a > 40) {
        dst[i] = 0;
        dst[i + 1] = 0;
        dst[i + 2] = 0;
        dst[i + 3] = 255; // 100% K100 mask for stamping die
      } else {
        dst[i + 3] = 0; // Transparent
      }
    }

    return dstImageData;
  }
}
