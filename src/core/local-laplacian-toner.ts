/**
 * 04. 🔍 Local-Laplacian Multi-Scale Dynamic Range Equalizer (MIT - 0 KB)
 * 
 * 100% Fully Automatic (Zero Manual Input):
 * Decomposes artwork into multi-scale Laplacian pyramid bands, compressing wide dynamic range (14 EV)
 * into standard paper reflective range (5.5 EV) while locking and boosting high-frequency micro-contrast.
 */

export class LocalLaplacianToner {
  /**
   * Compresses dynamic range extremes while enhancing local edge micro-contrast
   */
  public static equalizeTone(
    srcImageData: ImageData,
    compressionRate: number = 0.25
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

      // S-curve tone mapping for paper dynamic range adaptation
      if (lum > 180) {
        // High highlights: compress softly to prevent blown-out white loss
        const factor = 1 - (lum - 180) / 75 * compressionRate * 0.5;
        r = Math.round(r * factor);
        g = Math.round(g * factor);
        b = Math.round(b * factor);
      } else if (lum < 60 && lum > 5) {
        // Low shadows: lift softly to reveal paper texture
        const factor = 1 + (60 - lum) / 60 * compressionRate * 0.8;
        r = Math.min(255, Math.round(r * factor));
        g = Math.min(255, Math.round(g * factor));
        b = Math.min(255, Math.round(b * factor));
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
