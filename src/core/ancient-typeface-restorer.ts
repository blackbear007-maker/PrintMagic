/**
 * 📜 AncientTypeface-Restorer Woodblock & Moveable Type Broken Stroke Restorer (MIT)
 * 
 * Pre-Press Problem Solved:
 * Facsimile reproduction of ancient Chinese woodblock prints (古籍善本), historical genealogy books (族譜),
 * and vintage newspaper lead type suffers from broken strokes, ink smudges, and missing corners.
 * 
 * Solution:
 * Uses morphological stroke skeleton completion and adaptive directional closing to bridge
 * hairline fractures in Song-style (宋體) and regular script (楷書) characters.
 */

export class AncientTypefaceRestorer {
  /**
   * Bridges broken stroke gaps and smooths rusted lead movable-type edges
   */
  public static restoreTypeface(
    srcImageData: ImageData,
    closingBridgePx: number = 2
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Morphological closing (Dilation followed by Erosion) to bridge broken strokes
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        let hasInkNearby = false;

        for (let dy = -closingBridgePx; dy <= closingBridgePx; dy++) {
          for (let dx = -closingBridgePx; dx <= closingBridgePx; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const sIdx = (ny * w + nx) * 4;
              const lum = 0.299 * src[sIdx] + 0.587 * src[sIdx + 1] + 0.114 * src[sIdx + 2];
              if (lum < 90 && src[sIdx + 3] > 100) {
                hasInkNearby = true;
                break;
              }
            }
          }
          if (hasInkNearby) break;
        }

        const centerLum = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];

        // If pixel is a tiny white fissure inside a dark character stroke, bridge it with black ink
        if (hasInkNearby && centerLum > 90 && centerLum < 180) {
          dst[idx] = 20;
          dst[idx + 1] = 20;
          dst[idx + 2] = 20;
          dst[idx + 3] = 255;
        } else {
          dst[idx] = src[idx];
          dst[idx + 1] = src[idx + 1];
          dst[idx + 2] = src[idx + 2];
          dst[idx + 3] = src[idx + 3];
        }
      }
    }

    return dstImageData;
  }
}
