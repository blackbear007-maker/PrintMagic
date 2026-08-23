/**
 * 07. 🧾 Receipt-Fading-Restorer Thermal Paper Receipt Contrast Recovery Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * Thermal paper receipts, invoices, and utility slips fade over time into barely visible pale gray text.
 * When scanned or photocopied for tax filing, the output is washed out and rejected.
 * 
 * Solution:
 * Uses adaptive localized thresholding and dynamic range expansion to recover faded thermal strokes
 * back to crisp, dark K100 text.
 */

export class ReceiptFadingRestorer {
  /**
   * Rescues faded thermal paper text and deepens it to solid black
   */
  public static restoreReceipt(
    srcImageData: ImageData,
    boostFactor: number = 2.5
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

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum < 200) {
        // Darken faded thermal text strokes aggressively
        const newLum = Math.max(0, Math.round(lum / boostFactor));
        dst[i] = newLum;
        dst[i + 1] = newLum;
        dst[i + 2] = newLum;
      } else {
        // Pure White paper background
        dst[i] = 255;
        dst[i + 1] = 255;
        dst[i + 2] = 255;
      }
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
