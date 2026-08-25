/**
 * ⚡ Fixed-Kernel Deconvolution Sharpener (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * A fixed 5x5 unsharp-style convolution kernel blended with the source. It is not a learned
 * deblurring network (no Stripformer/Restormer/NAFNet weights are loaded) — it cannot recover
 * detail that motion blur has genuinely destroyed, only boost existing local contrast.
 */

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
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Fixed 5x5 sharpening deconvolution kernel (suppresses ringing halos)
    const kernel5x5 = [
      -0.01, -0.02, -0.04, -0.02, -0.01,
      -0.02, -0.05, -0.12, -0.05, -0.02,
      -0.04, -0.12,  2.08, -0.12, -0.04,
      -0.02, -0.05, -0.12, -0.05, -0.02,
      -0.01, -0.02, -0.04, -0.02, -0.01
    ];

    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const centerIdx = (y * w + x) * 4;

        let accR = 0, accG = 0, accB = 0;
        let kIdx = 0;

        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const pIdx = ((y + dy) * w + (x + dx)) * 4;
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
