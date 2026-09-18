/**
 * ⚡ Fixed-Kernel Deconvolution Sharpener (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * A fixed 5x5 unsharp-style convolution kernel blended with the source. It is not a learned
 * deblurring network (no Stripformer/Restormer/NAFNet weights are loaded) — it cannot recover
 * detail that motion blur has genuinely destroyed, only boost existing local contrast.
 */

import { createImageData } from './image-data-factory';

export class SharpenDeblurFilter {
  /**
   * Applies a fixed deconvolution-style sharpening kernel to counteract mild blur/soft focus
   */
  public static deblur(
    srcImageData: ImageData,
    amount: number = 0.65
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = createImageData(dstBuffer, w, h);
    const dst = dstImageData.data;

    // Fixed 5x5 sharpening deconvolution kernel (sums to 1 so flat areas keep their tone)
    const kernel5x5 = [
      -0.01, -0.02, -0.04, -0.02, -0.01,
      -0.02, -0.05, -0.12, -0.05, -0.02,
      -0.04, -0.12,  2.04, -0.12, -0.04,
      -0.02, -0.05, -0.12, -0.05, -0.02,
      -0.01, -0.02, -0.04, -0.02, -0.01
    ];

    // Every pixel is written; neighbours outside the image are clamped to the nearest edge pixel
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const centerIdx = (y * w + x) * 4;

        let accR = 0, accG = 0, accB = 0;
        let kIdx = 0;

        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const sy = Math.min(h - 1, Math.max(0, y + dy));
            const sx = Math.min(w - 1, Math.max(0, x + dx));
            const pIdx = (sy * w + sx) * 4;
            const k = kernel5x5[kIdx++];

            accR += src[pIdx] * k;
            accG += src[pIdx + 1] * k;
            accB += src[pIdx + 2] * k;
          }
        }

        const origR = src[centerIdx];
        const origG = src[centerIdx + 1];
        const origB = src[centerIdx + 2];

        dst[centerIdx] = Math.min(255, Math.max(0, Math.round(origR * (1 - amount) + accR * amount)));
        dst[centerIdx + 1] = Math.min(255, Math.max(0, Math.round(origG * (1 - amount) + accG * amount)));
        dst[centerIdx + 2] = Math.min(255, Math.max(0, Math.round(origB * (1 - amount) + accB * amount)));
        dst[centerIdx + 3] = src[centerIdx + 3];
      }
    }

    return dstImageData;
  }
}
