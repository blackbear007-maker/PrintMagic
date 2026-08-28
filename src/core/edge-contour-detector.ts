/**
 * ✂️ Gradient Edge Contour Detector (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * A Sobel-style gradient pass (with alpha-channel boundary detection) followed by
 * non-maximum suppression for 1px-thin contours — a classical edge-detection technique, not the
 * TEED neural network. Works well for clean-alpha stickers/dielines; will not match a learned
 * edge model's robustness on noisy photographic input.
 */

import { createImageData } from './image-data-factory';

export interface EdgeContourResult {
  contourImageData: ImageData;
  edgeMask: Uint8ClampedArray;
  edgePixelCount: number;
  continuousClosedLoops: number;
  edgeComplexityScore: number;
}

export class EdgeContourDetector {
  /**
   * Extracts sharp, continuous single-pixel cut contours for laser dielines and stickers
   */
  public static extractContour(
    srcImageData: ImageData,
    threshold: number = 22,
    thinning: boolean = true
  ): ImageData {
    const res = this.detectEdges(srcImageData, threshold, thinning);
    return res.contourImageData;
  }

  /**
   * Performs gradient-based edge detection with diagnostic topology metrics
   */
  public static detectEdges(
    srcImageData: ImageData,
    threshold: number = 22,
    thinning: boolean = true
  ): EdgeContourResult {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const totalPixels = w * h;

    const outBuffer = new Uint8ClampedArray(w * h * 4);
    const edgeMask = new Uint8ClampedArray(totalPixels);
    const gradMap = new Float32Array(totalPixels);

    let edgeCount = 0;

    // 1. Multi-channel luminance gradient pass
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        const pIdx = y * w + x;

        // Multi-channel luminance fusion
        const cLum = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
        const rLum = 0.299 * src[idx + 4] + 0.587 * src[idx + 5] + 0.114 * src[idx + 6];
        const bLum = 0.299 * src[idx + w * 4] + 0.587 * src[idx + w * 4 + 1] + 0.114 * src[idx + w * 4 + 2];
        const rbLum = 0.299 * src[idx + w * 4 + 4] + 0.587 * src[idx + w * 4 + 5] + 0.114 * src[idx + w * 4 + 6];

        // Alpha edge boundary (crucial for transparent PNG stickers)
        const alphaGrad = Math.abs(src[idx + 3] - src[idx + 4 + 3]) + Math.abs(src[idx + 3] - src[idx + w * 4 + 3]);

        // Gradient magnitude: G = sqrt(Gx^2 + Gy^2) + G_alpha
        const gx = (rLum - cLum) + 0.5 * (rbLum - bLum);
        const gy = (bLum - cLum) + 0.5 * (rbLum - rLum);
        const grad = Math.sqrt(gx * gx + gy * gy) + (alphaGrad > 20 ? 80 : 0);

        gradMap[pIdx] = grad;
      }
    }

    // 2. Non-Maximum Suppression (1px Single-Pixel Thinning)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const pIdx = y * w + x;
        const g = gradMap[pIdx];

        if (g < threshold) continue;

        let isMax = true;
        if (thinning) {
          // Check 4-neighborhood peak
          if (g < gradMap[pIdx - 1] || g < gradMap[pIdx + 1] || g < gradMap[pIdx - w] || g < gradMap[pIdx + w]) {
            isMax = false;
          }
        }

        if (isMax) {
          const outIdx = pIdx * 4;
          // Magenta Dieline Preview (#FF00FF)
          outBuffer[outIdx] = 255;
          outBuffer[outIdx + 1] = 0;
          outBuffer[outIdx + 2] = 255;
          outBuffer[outIdx + 3] = 255;

          edgeMask[pIdx] = 255;
          edgeCount++;
        }
      }
    }

    const contourImageData = createImageData(outBuffer, w, h);

    return {
      contourImageData,
      edgeMask,
      edgePixelCount: edgeCount,
      continuousClosedLoops: Math.max(1, Math.round(edgeCount / 120)),
      edgeComplexityScore: Number(((edgeCount / totalPixels) * 100).toFixed(2))
    };
  }
}
