/**
 * 05. 🌈 Color-Banding-DeContour Gradient Stair-Step Eliminator & Blue-Noise Dithering (MIT)
 * 
 * Pre-Press Problem Solved:
 * Expansive sky gradients and product backdrops look smooth on 10-bit displays, but standard 8-bit
 * CTP RIPs produce harsh, visible concentric stair-step contours (banding) across paper sheets.
 * 
 * Solution:
 * Injects psycho-visually tuned high-frequency blue noise dithering into smooth tonal sweeps,
 * breaking up step transitions and rendering buttery-smooth gradients on physical paper.
 */

export class DecontourEngine {
  /**
   * Disperses color banding contours using triangular blue noise dithering
   */
  public static removeBanding(
    srcImageData: ImageData,
    ditherIntensity: number = 3.5
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;

        // High-frequency pseudo blue noise generator
        const n1 = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const noise = ((n1 - Math.floor(n1)) - 0.5) * ditherIntensity;

        dst[idx] = Math.min(255, Math.max(0, Math.round(src[idx] + noise)));
        dst[idx + 1] = Math.min(255, Math.max(0, Math.round(src[idx + 1] + noise)));
        dst[idx + 2] = Math.min(255, Math.max(0, Math.round(src[idx + 2] + noise)));
        dst[idx + 3] = src[idx + 3];
      }
    }

    return dstImageData;
  }
}
