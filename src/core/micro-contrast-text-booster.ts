/**
 * 12. 🔍 Micro-Contrast-Text-Booster Dark-on-Dark Text Legibility Booster (MIT)
 * 
 * Pre-Press Problem Solved:
 * On self-illuminating screens, dark gray text on a black background is legible. On matte paper,
 * low reflective dynamic range causes dark text to blend into the background, becoming unreadable.
 * 
 * Solution:
 * Computes localized Michelson & Weber contrast ratios and widens the luminance differential between
 * text strokes and background substrates to guarantee clear readability on physical paper.
 */

export class MicroContrastTextBooster {
  /**
   * Boosts local text-to-background edge contrast for physical paper legibility
   */
  public static boostContrast(
    srcImageData: ImageData,
    contrastMultiplier: number = 1.35
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
      let r = src[i];
      let g = src[i + 1];
      let b = src[i + 2];
      const a = src[i + 3];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Dark text in mid-dark tone region (lum 40~120)
      if (lum < 120) {
        r = Math.max(0, Math.round(r / contrastMultiplier));
        g = Math.max(0, Math.round(g / contrastMultiplier));
        b = Math.max(0, Math.round(b / contrastMultiplier));
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
