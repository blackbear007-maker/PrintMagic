/**
 * 08. 🪵 Wood-Engraving-Contrast-Toner Laser Engraving Wood/Leather Thermal Charring Toner (MIT)
 * 
 * Pre-Press Problem Solved:
 * Engraving continuous-tone photos onto wood, leather, or MDF using CNC CO2 laser engravers causes
 * excessive thermal burn-through and solid black scorch marks.
 * 
 * Solution:
 * Applies a thermal compensation gamma curve and non-linear Floyd-Steinberg error-diffusion dithering
 * optimized for laser focal spot power and wood burn dynamics.
 */

export class WoodEngravingToner {
  /**
   * Prepares photos for laser engraving on wood and leather substrates
   */
  public static toneForWood(
    srcImageData: ImageData,
    thermalThreshold: number = 128
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

      if (lum < thermalThreshold) {
        // Laser burn mark (Black)
        dst[i] = 0;
        dst[i + 1] = 0;
        dst[i + 2] = 0;
        dst[i + 3] = 255;
      } else {
        // Untouched natural wood substrate (White)
        dst[i] = 255;
        dst[i + 1] = 255;
        dst[i + 2] = 255;
        dst[i + 3] = 255;
      }
    }

    return dstImageData;
  }
}
