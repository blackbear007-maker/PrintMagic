/**
 * 07. ✨ Varnish-SpotUV-Dilator Spot UV Varnish Registration Compensation Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * Screen-applied UV gloss varnish (局部上光) registration drifts by 0.1~0.2mm during high-speed drying.
 * If the UV mask matches the printed artwork 1:1, slight misalignments look defective.
 * 
 * Solution:
 * Computes morphological dilation (0.15mm spread) or erosion (choke) to ensure spot UV
 * varnish completely envelopes target elements without awkward edge steps.
 */

export class SpotUvDilator {
  /**
   * Dilates spot UV varnish mask by specified pixel width (e.g. 0.15mm at 300 DPI = ~2px)
   */
  public static dilateUvMask(
    srcMask: ImageData,
    dilationPx: number = 2
  ): ImageData {
    const w = srcMask.width;
    const h = srcMask.height;
    const src = srcMask.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Fast morphological dilation
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let isCovered = false;

        for (let dy = -dilationPx; dy <= dilationPx; dy++) {
          for (let dx = -dilationPx; dx <= dilationPx; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const idx = (ny * w + nx) * 4;
              if (src[idx + 3] > 128) {
                isCovered = true;
                break;
              }
            }
          }
          if (isCovered) break;
        }

        const outIdx = (y * w + x) * 4;
        if (isCovered) {
          dst[outIdx] = 0;
          dst[outIdx + 1] = 0;
          dst[outIdx + 2] = 0;
          dst[outIdx + 3] = 255;
        } else {
          dst[outIdx + 3] = 0;
        }
      }
    }

    return dstImageData;
  }
}
