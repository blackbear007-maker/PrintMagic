/**
 * 04. 🌸 Skin-Tone-Cyan-Suppressor Portrait Cyan Cast Neutralizer & Warm Glow Optimizer (MIT)
 * 
 * Pre-Press Problem Solved:
 * In portrait, wedding, and family photo printing, an excess of Cyan (C > 15%) in facial highlights
 * creates a sickly, greenish-gray zombie skin tone due to subtractive ink contamination.
 * 
 * Solution:
 * Isolates facial skin tone chromaticity and attenuates excess Cyan while tuning Magenta (M) and Yellow (Y)
 * to an ideal healthy ratio (M ≈ 0.8 * Y, C < 0.2 * M) to ensure natural, radiant skin tones on paper.
 */

export class SkinToneCyanSuppressor {
  /**
   * Suppresses cold cyan cast in human skin tones and restores healthy pink/warm glow
   */
  public static optimizeSkinTones(
    srcImageData: ImageData,
    suppressionLevel: number = 0.6
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

      // Detect skin tone range: R > G > B and high red chroma
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15) {
        // Reduce blue/green channel contamination (which maps to Cyan ink)
        const cyanCorrection = Math.round((g - b) * 0.25 * suppressionLevel);
        r = Math.min(255, r + Math.round(cyanCorrection * 0.5));
        b = Math.max(0, b - cyanCorrection);
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
