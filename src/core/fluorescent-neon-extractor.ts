/**
 * 09. ⚡ Fluorescent-Neon-Ink-Extractor Spot Neon Pink/Green 5th Channel Film Separator (MIT)
 * 
 * Pre-Press Problem Solved:
 * Club posters, anime fanzines, and rave flyers want to add a 5th special fluorescent ink pass
 * (e.g. Pantone 806C Neon Pink / Pantone 802C Neon Green). Designers struggle to separate neon elements.
 * 
 * Solution:
 * Uses high-saturation, high-luminance chromaticity isolation to generate an isolated 100% K100
 * plate for the 5th fluorescent ink printing unit.
 */

export interface NeonExtractionOutput {
  neonPlateK100: ImageData;
  spotColorName: string;
  coveragePercent: number;
}

export class FluorescentNeonExtractor {
  /**
   * Isolates ultra-vivid neon pink or neon green colors onto an independent 5th spot color plate
   */
  public static extractNeonChannel(
    srcImageData: ImageData,
    targetNeon: 'pink' | 'green' = 'pink'
  ): NeonExtractionOutput {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const plateBuffer = new Uint8ClampedArray(w * h * 4);
    const plateImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(plateBuffer, w, h)
      : ({ width: w, height: h, data: plateBuffer, colorSpace: 'srgb' } as ImageData);
    const pData = plateImageData.data;

    let neonPixels = 0;
    const totalPixels = w * h;

    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const a = src[i + 3];

      let isNeon = false;

      if (targetNeon === 'pink') {
        // High Red & Blue with low Green (Hot Neon Magenta/Pink)
        if (r > 200 && b > 140 && g < 120 && a > 40) isNeon = true;
      } else {
        // High Green with low Red & Blue (Vibrant Lime/Neon Green)
        if (g > 200 && r < 140 && b < 140 && a > 40) isNeon = true;
      }

      if (isNeon) {
        pData[i] = 0;
        pData[i + 1] = 0;
        pData[i + 2] = 0;
        pData[i + 3] = 255; // 100% K100 spot plate
        neonPixels++;
      } else {
        pData[i + 3] = 0;
      }
    }

    const coverage = Number(((neonPixels / totalPixels) * 100).toFixed(1));

    return {
      neonPlateK100: plateImageData,
      spotColorName: targetNeon === 'pink' ? 'Pantone 806 C (Fluorescent Pink)' : 'Pantone 802 C (Fluorescent Green)',
      coveragePercent: coverage
    };
  }
}
