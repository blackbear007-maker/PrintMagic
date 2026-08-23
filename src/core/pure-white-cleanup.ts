/**
 * 03. 🧼 Pure-White-Clean-Up Near-White Background Degraying & Ink-Waste Eliminator (MIT)
 * 
 * Pre-Press Problem Solved:
 * Smartphone scans of children's drawings, physical certificates, and product photos on white paper
 * frequently carry a 230~250 RGB grayish-yellow tint. When sent to press, the printer covers the entire
 * sheet with a dirty, hazy layer of CMYK dots, wasting ink and looking unprofessional.
 * 
 * Solution:
 * Maps 225~255 RGB near-white backgrounds to pure 255/transparent, ensuring 0% ink coverage on pure paper margins.
 */

export class PureWhiteCleanup {
  /**
   * Snaps near-white paper tint (RGB > threshold) to 100% pure white or transparent
   */
  public static cleanNearWhite(
    srcImageData: ImageData,
    whiteThreshold: number = 230,
    makeTransparent: boolean = false
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

      const minChannel = Math.min(r, g, b);

      if (minChannel >= whiteThreshold) {
        if (makeTransparent) {
          dst[i] = 255;
          dst[i + 1] = 255;
          dst[i + 2] = 255;
          dst[i + 3] = 0; // Pure alpha transparency
        } else {
          dst[i] = 255;
          dst[i + 1] = 255;
          dst[i + 2] = 255;
          dst[i + 3] = a; // Pure paper white
        }
      } else {
        dst[i] = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
        dst[i + 3] = a;
      }
    }

    return dstImageData;
  }
}
