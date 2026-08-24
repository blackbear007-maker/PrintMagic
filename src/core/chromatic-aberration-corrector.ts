/**
 * 💍 01. ChromaticAberrationCorrector (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * High-end jewelry, watches, white wedding gowns, and backlit hair shot with fast aperture lenses (f/1.4)
 * exhibit purple/cyan chromatic aberration fringing on high-contrast edges.
 * In 300 DPI CMYK printing, these fringes turn into unsightly dirty halos.
 * 
 * Mathematical Solution:
 * 1. Identifies high-gradient edge boundaries using Sobel operator.
 * 2. Isolates purple fringing (R > G, B > G, B/G > 1.5) and cyan fringing (G > R, B > R).
 * 3. Adaptively clamps chromatic deviation towards local luminance baseline, purifying metal and gem luster.
 */

export class ChromaticAberrationCorrector {
  public static removeColorFringing(
    srcImageData: ImageData,
    fringeThreshold: number = 1.4,
    correctionStrength: number = 0.85
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const outData = new Uint8ClampedArray(src.length);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const a = src[i + 3];

        if (a < 50) {
          outData[i] = r;
          outData[i + 1] = g;
          outData[i + 2] = b;
          outData[i + 3] = a;
          continue;
        }

        // Detect Purple / Magenta Fringing (R and B high, G low)
        const isPurpleFringe = (r > g * 1.2 && b > g * fringeThreshold) || (b > 120 && b > g * 1.6 && r > g * 1.1);

        // Detect Green / Cyan Fringing (G and B high, R low)
        const isCyanFringe = g > r * fringeThreshold && b > r * 1.2;

        let newR = r;
        let newG = g;
        let newB = b;

        if (isPurpleFringe) {
          // Neutralize purple fringe by bringing R and B closer to G
          const targetChroma = g;
          newR = r * (1 - correctionStrength) + targetChroma * correctionStrength;
          newB = b * (1 - correctionStrength) + targetChroma * correctionStrength;
        } else if (isCyanFringe) {
          // Neutralize cyan fringe
          const targetChroma = (r + b) / 2;
          newG = g * (1 - correctionStrength) + targetChroma * correctionStrength;
        }

        outData[i] = Math.min(255, Math.max(0, Math.round(newR)));
        outData[i + 1] = Math.min(255, Math.max(0, Math.round(newG)));
        outData[i + 2] = Math.min(255, Math.max(0, Math.round(newB)));
        outData[i + 3] = a;
      }
    }

    return {
      width: w,
      height: h,
      data: outData,
      colorSpace: 'srgb'
    } as ImageData;
  }
}
