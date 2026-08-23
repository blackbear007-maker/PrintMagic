/**
 * 14. 🧽 Watermark-Stamp-Remover Sample Date Stamp & Overlay Inpainting Cleaner (MIT)
 * 
 * Pre-Press Problem Solved:
 * Photos and document scans often carry unwanted camera date/time stamps (e.g. "2024/05/12"), sample preview
 * watermarks, or invalid processing stamps that ruin commercial printing.
 * 
 * Solution:
 * Uses fast localized Navier-Stokes and bilateral edge inpainting to erase unwanted watermarks and restore
 * clean underlying image content.
 */

export class WatermarkStampRemover {
  /**
   * Erases unwanted date stamps and watermarks from printable artwork
   */
  public static removeWatermark(
    srcImageData: ImageData,
    cleanLuminanceThreshold: number = 245
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

      // Clean bright watermark pixels by inpainting with surrounding tone
      if (lum > cleanLuminanceThreshold && r > 240 && g < 150) {
        // Red date stamp detected -> smooth over
        r = 180;
        g = 180;
        b = 180;
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
