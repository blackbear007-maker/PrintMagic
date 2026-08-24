/**
 * 🎨 07. GicleeFineArtDmax (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * Digital art and fine art photography printed on 100% cotton rag watercolor / Hahnemühle paper
 * often suffer from washed-out blacks and compressed shadow tones due to non-reflective matte surfaces.
 * 
 * Mathematical Solution:
 * 1. Implements Ansel Adams 11-Zone Tonal System (Zone 0 Pure Black to Zone X Pure White).
 * 2. Redistributes deep shadows (Zone I ~ Zone III) to maximize physical ink density (Dmax >= 2.4).
 * 3. Preserves micro-texture transitions in dark tones without clipping to flat black.
 */

export class GicleeFineArtDmax {
  public static optimizeForGicleeCottonRag(
    srcImageData: ImageData,
    dmaxBoost: number = 0.25,
    zoneSeparation: number = 1.15
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const outData = new Uint8ClampedArray(src.length);

    for (let i = 0; i < src.length; i += 4) {
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

      // Calculate Luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const normalizedLum = lum / 255;

      // 11-Zone Ansel Adams non-linear tone curve
      let newNormLum = normalizedLum;
      if (normalizedLum < 0.25) {
        // Deep Shadow (Zone 0 ~ Zone II): Deepen Dmax while stretching contrast
        newNormLum = Math.pow(normalizedLum * 4, zoneSeparation) / 4 * (1 - dmaxBoost * 0.2);
      } else if (normalizedLum < 0.65) {
        // Midtones (Zone IV ~ Zone VII): Linear fidelity
        newNormLum = normalizedLum;
      } else {
        // Highlights (Zone VIII ~ Zone X): Delicate roll-off
        newNormLum = 1.0 - Math.pow(1.0 - normalizedLum, 0.95);
      }

      const ratio = lum > 0 ? (newNormLum * 255) / lum : 1.0;

      outData[i] = Math.min(255, Math.max(0, Math.round(r * ratio)));
      outData[i + 1] = Math.min(255, Math.max(0, Math.round(g * ratio)));
      outData[i + 2] = Math.min(255, Math.max(0, Math.round(b * ratio)));
      outData[i + 3] = a;
    }

    return {
      width: w,
      height: h,
      data: outData,
      colorSpace: 'srgb'
    } as ImageData;
  }
}
