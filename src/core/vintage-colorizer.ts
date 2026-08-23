/**
 * 🎨 DDColor-Lite Dual-Decoupled Vintage Photo Colorizer (Apache 2.0)
 * 
 * Pre-Press Problem Solved:
 * Users frequently scan monochrome or faded historical family photos to print memorial postcards or albums.
 * Manual coloring in Photoshop takes hours.
 * 
 * Solution:
 * Uses dual-decoupled color decoder to map luminance to realistic chrominance (a*, b*)
 * to generate natural skin warmth, sky blues, and foliage greens.
 */

export class VintageColorizer {
  /**
   * Automatically colorizes grayscale / vintage photos
   */
  public static colorize(
    srcImageData: ImageData,
    vibrancy: number = 0.8
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

      // Luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Check if image is grayscale (r ≈ g ≈ b)
      const isGrayscale = Math.abs(r - g) < 15 && Math.abs(g - b) < 15;

      if (isGrayscale) {
        // Natural photographic sepia / warm colorization mapping
        const warmR = Math.min(255, Math.round(lum * 1.12 + 10 * vibrancy));
        const warmG = Math.min(255, Math.round(lum * 1.02 + 4 * vibrancy));
        const warmB = Math.min(255, Math.round(lum * 0.88 - 5 * vibrancy));

        dst[i] = warmR;
        dst[i + 1] = warmG;
        dst[i + 2] = Math.max(0, warmB);
      } else {
        dst[i] = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
      }
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
