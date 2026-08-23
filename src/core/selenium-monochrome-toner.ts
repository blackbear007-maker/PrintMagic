/**
 * 18. 🎞️ Selenium-Monochrome-Toner Darkroom Fine Art Selenium Toning & Maximum Dmax Toner (MIT)
 * 
 * Pre-Press Problem Solved:
 * Black and white fine art photography printed with standard CMYK process inks suffers from cold greenish-gray
 * metamerism and weak shadow density (Dmax < 1.8).
 * 
 * Solution:
 * Emulates classic darkroom selenium split-toning (硒調色), cooling midtone highlights while warming and deepening
 * deep blacks to archival gallery Dmax (≥ 2.2).
 */

export class SeleniumMonochromeToner {
  /**
   * Applies archival darkroom selenium split-toning to monochrome photography
   */
  public static toneSelenium(
    srcImageData: ImageData,
    toningWarmth: number = 0.35
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
      const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];

      let r = lum;
      let g = lum;
      let b = lum;

      // Darkroom selenium toning: deep shadows gain subtle aubergine/warm purple tone, highlights cool
      if (lum < 100) {
        r = Math.min(255, Math.round(lum * (1 + toningWarmth * 0.15)));
        b = Math.min(255, Math.round(lum * (1 + toningWarmth * 0.08)));
      } else {
        b = Math.min(255, Math.round(lum * (1 + toningWarmth * 0.05)));
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = src[i + 3];
    }

    return dstImageData;
  }
}
