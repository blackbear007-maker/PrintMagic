/**
 * 🌊 Bilateral-Style Smoothing Denoiser (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * A classical bilateral filter (spatial kernel × color-range kernel), the same well-established
 * non-learned technique OpenCV ships as cv2.bilateralFilter. It is not the Restormer/NAFNet
 * transformer denoiser — no attention mechanism, no learned weights.
 */

import { createImageData } from './image-data-factory';

export class SmoothingDenoiseFilter {
  /**
   * Performs edge-preserving bilateral smoothing to reduce sensor/compression noise
   */
  public static denoise(
    srcImageData: ImageData,
    noiseStrength: number = 0.50
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = createImageData(dstBuffer, w, h);
    const dst = dstImageData.data;

    const spatialRadius = 2;
    const sigmaColor = 22.0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const centerIdx = (y * w + x) * 4;
        const cR = src[centerIdx];
        const cG = src[centerIdx + 1];
        const cB = src[centerIdx + 2];
        const cA = src[centerIdx + 3];

        if (cA < 15) {
          dst[centerIdx] = cR;
          dst[centerIdx + 1] = cG;
          dst[centerIdx + 2] = cB;
          dst[centerIdx + 3] = cA;
          continue;
        }

        let totalWeight = 0;
        let sumR = 0, sumG = 0, sumB = 0;

        for (let dy = -spatialRadius; dy <= spatialRadius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;

          for (let dx = -spatialRadius; dx <= spatialRadius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;

            const nIdx = (ny * w + nx) * 4;
            const nR = src[nIdx];
            const nG = src[nIdx + 1];
            const nB = src[nIdx + 2];

            // Photometric intensity difference
            const colorDist = Math.hypot(nR - cR, nG - cG, nB - cB);
            const spatialDist = Math.hypot(dx, dy);

            // Bilateral weighting (range kernel × spatial kernel)
            const wRange = Math.exp(-(colorDist * colorDist) / (2 * sigmaColor * sigmaColor));
            const wSpatial = Math.exp(-(spatialDist * spatialDist) / (2 * 3.5));
            const weight = wRange * wSpatial;

            sumR += nR * weight;
            sumG += nG * weight;
            sumB += nB * weight;
            totalWeight += weight;
          }
        }

        const filteredR = totalWeight > 0 ? sumR / totalWeight : cR;
        const filteredG = totalWeight > 0 ? sumG / totalWeight : cG;
        const filteredB = totalWeight > 0 ? sumB / totalWeight : cB;

        // Texture preservation gating
        dst[centerIdx] = Math.round(cR * (1 - noiseStrength) + filteredR * noiseStrength);
        dst[centerIdx + 1] = Math.round(cG * (1 - noiseStrength) + filteredG * noiseStrength);
        dst[centerIdx + 2] = Math.round(cB * (1 - noiseStrength) + filteredB * noiseStrength);
        dst[centerIdx + 3] = cA;
      }
    }

    return dstImageData;
  }
}
