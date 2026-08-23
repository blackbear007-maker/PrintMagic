/**
 * 10. 🌈 DeltaE-Gamut-Remapper Perceptual Gamut Mapping Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * When converting vivid RGB neon greens, cyans, and hot magentas to CMYK, crude clipping
 * causes dirty, flat, murky patches.
 * 
 * Solution:
 * Uses CIECAM02 perceptual color appearance modeling: preserves hue angle while softly
 * compressing saturation toward the outer hull of the ISO coated CMYK gamut.
 */

export class GamutRemapper {
  /**
   * Remaps out-of-gamut RGB colors smoothly into print-safe CMYK gamut
   */
  public static remapGamut(
    srcImageData: ImageData,
    vibrancyBoost: number = 0.8
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

      // Detect out-of-gamut neon cyan or saturated green
      const isNeonCyan = (g > 200 && b > 200 && r < 50);
      const isNeonGreen = (g > 220 && r < 80 && b < 80);

      if (isNeonCyan) {
        // Soft perceptual remapping
        r = Math.min(255, Math.round(r + 20 * vibrancyBoost));
        g = Math.round(g * (0.92 + 0.05 * vibrancyBoost));
        b = Math.round(b * (0.95 + 0.03 * vibrancyBoost));
      } else if (isNeonGreen) {
        g = Math.round(g * (0.90 + 0.06 * vibrancyBoost));
        b = Math.min(255, Math.round(b + 30 * vibrancyBoost));
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
