/**
 * 01. 🌑 Deep-Shadow-Detail-Revealer Print Shadow Depth Recovery Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * Smartphone and OLED screens display deep black gradients clearly, but physical paper ink absorbency
 * causes 0%~15% dark shadow tones (suits, hair, night skies) to pool into an undifferentiated muddy black blob.
 * 
 * Solution:
 * Applies localized non-linear shadow curve expansion to separate 0%~15% dark tones into distinct,
 * printable pigment layers while preserving crisp specular black anchors.
 */

export class ShadowDetailRevealer {
  /**
   * Expands deep shadow tones (0~45 RGB) to prevent ink pooling on paper
   */
  public static revealShadows(
    srcImageData: ImageData,
    intensity: number = 0.75
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

      const lum = (0.299 * r + 0.587 * g + 0.114 * b);

      // Target deep shadows (lum < 50)
      if (lum < 50 && lum > 2) {
        const boost = Math.round((1 - lum / 50) * 32 * intensity);
        r = Math.min(255, r + boost);
        g = Math.min(255, g + boost);
        b = Math.min(255, b + boost);
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
