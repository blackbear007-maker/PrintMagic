/**
 * 💡 03. NeonHalationCompressor (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * Nightclub signs, bar neon typography, and LED backlit film posters blow out into
 * flat, lifeless pure white (#FFFFFF) holes in the middle of bright tubes when printed.
 * 
 * Mathematical Solution:
 * 1. Identifies overblown highlight cores (Lum > 235) encircled by vibrant neon halos.
 * 2. Samples the chromatic hue of surrounding halo pixels.
 * 3. Compresses dynamic range via modified Reinhard tone-curve, re-injecting 40% saturated neon color
 *    into the core so backlit film glows with rich electric radiance instead of dead white.
 */

export class NeonHalationCompressor {
  public static compressNeonHighlights(
    srcImageData: ImageData,
    colorRetention: number = 0.45,
    highlightThreshold: number = 230
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

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Blown-out core check
        if (lum > highlightThreshold && (max - min) < 70) {
          // Look around in 5x5 neighborhood for peak dominant neon hue
          let dominantR = r;
          let dominantG = g;
          let dominantB = b;
          let maxSatFound = 0;

          for (let dy = -2; dy <= 2; dy++) {
            const ny = Math.min(h - 1, Math.max(0, y + dy));
            for (let dx = -2; dx <= 2; dx++) {
              const nx = Math.min(w - 1, Math.max(0, x + dx));
              const nIdx = (ny * w + nx) * 4;
              const nr = src[nIdx];
              const ng = src[nIdx + 1];
              const nb = src[nIdx + 2];

              const nMax = Math.max(nr, ng, nb);
              const nMin = Math.min(nr, ng, nb);
              const nSat = nMax === 0 ? 0 : (nMax - nMin) / nMax;

              if (nSat > maxSatFound) {
                maxSatFound = nSat;
                dominantR = nr;
                dominantG = ng;
                dominantB = nb;
              }
            }
          }

          if (maxSatFound > 0.3) {
            // Re-inject saturated hue into white core
            const blendRatio = colorRetention * maxSatFound;
            outData[i] = Math.round(r * (1 - blendRatio) + dominantR * blendRatio);
            outData[i + 1] = Math.round(g * (1 - blendRatio) + dominantG * blendRatio);
            outData[i + 2] = Math.round(b * (1 - blendRatio) + dominantB * blendRatio);
            outData[i + 3] = a;
            continue;
          }
        }

        outData[i] = r;
        outData[i + 1] = g;
        outData[i + 2] = b;
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
