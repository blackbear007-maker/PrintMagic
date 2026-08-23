/**
 * 09. 👕 T-Shirt-Color-Knockout Garment Background Knockout & Breathable Screen/DTF Print Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * When printing graphics onto black or navy t-shirts via DTF/Screen printing, leaving the solid black background
 * in the artwork causes the printer to deposit a heavy, airtight rubbery sheet of white + black plastic ink
 * across the wearer's chest, resulting in an uncomfortable, unbreathable badge.
 * 
 * Solution:
 * Knocks out colors matching the garment substrate with soft alpha gradient tapering, letting the shirt's
 * physical fabric act as the dark color.
 */

export class TshirtColorKnockout {
  /**
   * Knocks out matching garment color to create soft, breathable, ink-saving apparel prints
   */
  public static knockoutGarmentColor(
    srcImageData: ImageData,
    targetGarmentHex: string = '#000000',
    colorTolerance: number = 30
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    // Parse target hex
    const targetR = parseInt(targetGarmentHex.slice(1, 3), 16) || 0;
    const targetG = parseInt(targetGarmentHex.slice(3, 5), 16) || 0;
    const targetB = parseInt(targetGarmentHex.slice(5, 7), 16) || 0;

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

      const diff = Math.sqrt(
        Math.pow(r - targetR, 2) +
        Math.pow(g - targetG, 2) +
        Math.pow(b - targetB, 2)
      );

      if (diff < colorTolerance) {
        // Complete knockout to garment fabric
        dst[i + 3] = 0;
      } else if (diff < colorTolerance * 1.8) {
        // Soft alpha feathering
        const alphaFactor = (diff - colorTolerance) / (colorTolerance * 0.8);
        dst[i] = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
        dst[i + 3] = Math.round(a * alphaFactor);
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
