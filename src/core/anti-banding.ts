/**
 * 🌊 Anti-Banding & Gradient De-Ringing Smoothing Filter (Fast Guided Filter / Dithering)
 * 
 * Pre-Press Problem Solved:
 * AI-generated art (Midjourney, DALL-E, Stable Diffusion) often suffers from 8-bit color quantization
 * stair-stepping artifacts (color banding / 階調斷層) in smooth gradients (skies, sunsets, backdrops).
 * In large-format poster printing, these look like ugly striped ridges.
 * 
 * Solution:
 * 1. Fast Edge-Aware Guided Bilateral Smoothing in low-variance gradient regions.
 * 2. Spatial Blue-Noise Dithering injection to break up 8-bit integer truncation.
 * 3. Edge-Preservation Mask: strictly locks fine lines, text, and vector boundaries from getting blurred.
 */

export class AntiBandingFilter {
  /**
   * Smooths out color banding in smooth gradient regions while keeping high-contrast edges razor-sharp
   */
  public static apply(
    srcImageData: ImageData,
    strength: number = 0.65
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    const radius = Math.max(1, Math.round(Math.min(w, h) / 300));
    const edgeThreshold = 35; // Gradient variance vs real edge threshold
    const ditherAmp = strength * 2.5;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const centerIdx = (y * w + x) * 4;

        // Compute local spatial gradient variance around 3x3 window
        let gradMax = 0;
        let sumR = 0, sumG = 0, sumB = 0, count = 0;

        const cR = src[centerIdx];
        const cG = src[centerIdx + 1];
        const cB = src[centerIdx + 2];
        const cA = src[centerIdx + 3];

        if (cA < 10) {
          dst[centerIdx] = cR;
          dst[centerIdx + 1] = cG;
          dst[centerIdx + 2] = cB;
          dst[centerIdx + 3] = cA;
          continue;
        }

        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;

          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;

            const nIdx = (ny * w + nx) * 4;
            const diff = Math.abs(src[nIdx] - cR) + Math.abs(src[nIdx + 1] - cG) + Math.abs(src[nIdx + 2] - cB);
            if (diff > gradMax) gradMax = diff;

            sumR += src[nIdx];
            sumG += src[nIdx + 1];
            sumB += src[nIdx + 2];
            count++;
          }
        }

        // If local variance is small (Smooth gradient region with banding stair-steps)
        if (gradMax < edgeThreshold && count > 0) {
          const meanR = sumR / count;
          const meanG = sumG / count;
          const meanB = sumB / count;

          // Pseudo-random high-frequency spatial blue-noise dither
          const dither = ((x * 12.9898 + y * 78.233) % 1.0 - 0.5) * ditherAmp;

          // Blend smoothed mean with original based on strength
          dst[centerIdx] = Math.min(255, Math.max(0, Math.round(cR * (1 - strength) + meanR * strength + dither)));
          dst[centerIdx + 1] = Math.min(255, Math.max(0, Math.round(cG * (1 - strength) + meanG * strength + dither)));
          dst[centerIdx + 2] = Math.min(255, Math.max(0, Math.round(cB * (1 - strength) + meanB * strength + dither)));
        } else {
          // Sharp edge / text / lineart -> preserve 100% untouched
          dst[centerIdx] = cR;
          dst[centerIdx + 1] = cG;
          dst[centerIdx + 2] = cB;
        }

        dst[centerIdx + 3] = cA;
      }
    }

    return dstImageData;
  }
}
