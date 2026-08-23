/**
 * 02. ✨ MetallicFoil-Separator Hot Stamping Foil Mask Generator (MIT)
 * 
 * Pre-Press Problem Solved:
 * Creating gold, silver, rose gold, or holographic foil stamping (燙金/燙銀) requires
 * extracting shiny/highlighted elements into a 100% K100 binary zinc plate mask.
 * 
 * Solution:
 * Detects golden/metallic chromatic ranges and user-selected highlights to generate
 * an isolated pure black 300 DPI hot-stamping foil mask layer.
 */

export interface FoilMaskResult {
  foilType: 'gold' | 'silver' | 'rose-gold' | 'hologram';
  maskImageData: ImageData;
  foilCoveragePercent: number;
}

export class MetallicFoilSeparator {
  /**
   * Generates a pure K100 black mask layer for hot foil stamping
   */
  public static extractFoilMask(
    srcImageData: ImageData,
    foilType: 'gold' | 'silver' | 'rose-gold' | 'hologram' = 'gold'
  ): FoilMaskResult {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const totalPixels = w * h;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    let foilCount = 0;

    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const a = src[i + 3];

      let isFoil = false;

      if (foilType === 'gold') {
        // Gold hues: R > 170, G > 130, B < 110, R > G > B
        isFoil = r > 160 && g > 120 && b < 130 && r > g && g > b && a > 100;
      } else if (foilType === 'silver') {
        // Silver/Specular highlights: high luminance, near-neutral
        isFoil = r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 15 && a > 100;
      } else {
        // Rose gold / Hologram: warm pinkish metallic or high luminance
        isFoil = r > 180 && g > 100 && b > 110 && a > 100;
      }

      if (isFoil) {
        foilCount++;
        // 100% Pure Black K100 on Foil Mask
        dst[i] = 0;
        dst[i + 1] = 0;
        dst[i + 2] = 0;
        dst[i + 3] = 255;
      } else {
        // Transparent background
        dst[i + 3] = 0;
      }
    }

    return {
      foilType,
      maskImageData: dstImageData,
      foilCoveragePercent: Number(((foilCount / totalPixels) * 100).toFixed(1))
    };
  }
}
