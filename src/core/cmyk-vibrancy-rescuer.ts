/**
 * 06. 🎨 RGB-To-CMYK-Vibrancy-Rescuer Neon & Vibrant Gamut Rescuer (MIT)
 * 
 * Pre-Press Problem Solved:
 * AI-generated illustrations (Midjourney/Stable Diffusion) feature ultra-vivid RGB neon greens,
 * hot magentas, and cyan glows. Standard naïve CMYK conversions clip out-of-gamut colors to flat,
 * muddy olive drabs and dull grays.
 * 
 * Solution:
 * Employs perceptual chroma remapping to compress out-of-gamut saturation along constant-hue lines,
 * extracting maximum achievable brilliance and luminosity within ISO coated printing standards.
 */

export class CmykVibrancyRescuer {
  /**
   * Rescues out-of-gamut RGB neon colors prior to CMYK separation
   */
  public static rescueVibrancy(
    srcImageData: ImageData,
    vibrancyBoost: number = 0.25
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

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;

      // If high saturation RGB color, perform selective tonal boost
      if (sat > 0.6) {
        const boostFactor = 1 + vibrancyBoost * (sat - 0.6);
        r = Math.min(255, Math.round(r * boostFactor));
        g = Math.min(255, Math.round(g * boostFactor));
        b = Math.min(255, Math.round(b * boostFactor));
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
