/**
 * 06. 🖨️ High-Pass Spatial Convolution Anti-Dot-Gain Crispener (MIT - 0 KB)
 * 
 * 100% Fully Automatic (Zero Manual Input):
 * Applies a 3x3 high-pass edge crisping spatial kernel to inject +5% local acutance into fine line boundaries,
 * physically counterbalancing the softening effect of physical paper ink dot gain.
 */

export class HighpassDotgainCrispener {
  /**
   * Automatically sharpens boundary acutance to counteract physical press dot gain
   */
  public static crispEdges(
    srcImageData: ImageData,
    crispStrength: number = 0.35
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = src[idx + c];
          const top = src[((y - 1) * w + x) * 4 + c];
          const bottom = src[((y + 1) * w + x) * 4 + c];
          const left = src[(y * w + (x - 1)) * 4 + c];
          const right = src[(y * w + (x + 1)) * 4 + c];

          const highPass = center * 5 - (top + bottom + left + right);
          dst[idx + c] = Math.min(255, Math.max(0, Math.round(center * (1 - crispStrength) + highPass * crispStrength)));
        }
        dst[idx + 3] = src[idx + 3];
      }
    }

    return dstImageData;
  }
}
