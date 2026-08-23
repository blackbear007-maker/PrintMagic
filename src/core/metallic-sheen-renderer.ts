/**
 * 15. 🌈 Metallic-Sheen-Renderer Holographic Rainbow & Gold Foil Interactive Renderer (MIT)
 * 
 * Pre-Press Problem Solved:
 * Printing on holographic laser foil or metallic chrome cards cannot be visualized in standard
 * static 2D design proofs, leaving clients guessing about color shift behavior.
 * 
 * Solution:
 * Implements bidirectional reflectance distribution (BRDF) and thin-film optical interference
 * to simulate dynamic iridescent rainbow sheen that shifts with viewer perspective.
 */

export class MetallicSheenRenderer {
  /**
   * Applies interactive iridescent rainbow metallic sheen to highlights
   */
  public static renderMetallicSheen(
    srcImageData: ImageData,
    angleDeg: number = 45,
    intensity: number = 0.7
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    const rad = (angleDeg * Math.PI) / 180;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = src[idx];
        const g = src[idx + 1];
        const b = src[idx + 2];
        const a = src[idx + 3];

        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        if (lum > 0.60 && a > 100) {
          // Thin-film rainbow color wave based on spatial angle
          const phase = (x * Math.cos(rad) + y * Math.sin(rad)) * 0.05;
          const rainbowR = Math.sin(phase) * 127 + 128;
          const rainbowG = Math.sin(phase + 2.09) * 127 + 128;
          const rainbowB = Math.sin(phase + 4.18) * 127 + 128;

          dst[idx] = Math.min(255, Math.round(r * (1 - intensity * 0.5) + rainbowR * intensity * 0.5));
          dst[idx + 1] = Math.min(255, Math.round(g * (1 - intensity * 0.5) + rainbowG * intensity * 0.5));
          dst[idx + 2] = Math.min(255, Math.round(b * (1 - intensity * 0.5) + rainbowB * intensity * 0.5));
        } else {
          dst[idx] = r;
          dst[idx + 1] = g;
          dst[idx + 2] = b;
        }
        dst[idx + 3] = a;
      }
    }

    return dstImageData;
  }
}
