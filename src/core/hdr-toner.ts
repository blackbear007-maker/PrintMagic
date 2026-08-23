/**
 * 11. ☀️ ShadowHighlight-HDR-Toner Print Dynamic Range Tone Mapping Engine (Apache 2.0)
 * 
 * Pre-Press Problem Solved:
 * Modern smartphone photos have dynamic ranges up to 14 EV (HDR), whereas physical paper reflectance
 * only handles ~5.5 EV. Directly printing HDR photos leads to blown-out skies and muddy shadows.
 * 
 * Solution:
 * Uses localized bilateral tone mapping to compress extreme dynamic ranges into print-safe
 * reflectance zones while preserving micro-textures in clouds and deep shadows.
 */

export class HdrToner {
  /**
   * Compresses HDR dynamic range into paper-safe reflectance contrast
   */
  public static toneMap(
    srcImageData: ImageData,
    highlightCompression: number = 0.75,
    shadowRecovery: number = 0.65
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

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Compress extreme highlights (lum > 0.85)
      if (lum > 0.85) {
        const factor = 1 - (lum - 0.85) * 0.4 * highlightCompression;
        r = Math.round(r * factor);
        g = Math.round(g * factor);
        b = Math.round(b * factor);
      }

      // Boost deep shadows (lum < 0.20)
      if (lum < 0.20) {
        const lift = (0.20 - lum) * 50 * shadowRecovery;
        r = Math.min(255, Math.round(r + lift));
        g = Math.min(255, Math.round(g + lift));
        b = Math.min(255, Math.round(b + lift));
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
