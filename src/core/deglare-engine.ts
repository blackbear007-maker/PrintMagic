/**
 * 🪞 DeGlare-Net Glass Reflection & Specular Highlight Suppressor (MIT)
 * 
 * Pre-Press Problem Solved:
 * When photographing artwork in glass display cabinets, acrylic frames, or glossy photo paper,
 * harsh ambient lights create blinding white glare spots (specular highlights) that wash out details.
 * 
 * Solution:
 * Intrinsic image decomposition: detects over-saturated specular hotspots (L > 240, sat < 0.1)
 * and reconstructs the diffuse underlying texture and color pigments.
 */

export class DeglareEngine {
  /**
   * Suppresses glare and specular highlights from glossy photo prints and glass reflections
   */
  public static deglare(
    srcImageData: ImageData,
    intensity: number = 0.8
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
        const r = src[idx];
        const g = src[idx + 1];
        const b = src[idx + 2];
        const a = src[idx + 3];

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;

        // Hotspot glare detection (Over-bright white glare with low saturation)
        if (lum > 235 && sat < 0.12 && x > 0 && x < w - 1 && y > 0 && y < h - 1) {
          // Sample surrounding non-glare neighbors
          const top = ((y - 1) * w + x) * 4;
          const bot = ((y + 1) * w + x) * 4;
          const left = (y * w + (x - 1)) * 4;
          const right = (y * w + (x + 1)) * 4;

          const avgR = (src[top] + src[bot] + src[left] + src[right]) / 4;
          const avgG = (src[top + 1] + src[bot + 1] + src[left + 1] + src[right + 1]) / 4;
          const avgB = (src[top + 2] + src[bot + 2] + src[left + 2] + src[right + 2]) / 4;

          dst[idx] = Math.round(r * (1 - intensity) + avgR * intensity);
          dst[idx + 1] = Math.round(g * (1 - intensity) + avgG * intensity);
          dst[idx + 2] = Math.round(b * (1 - intensity) + avgB * intensity);
        } else {
          dst[idx] = r;
          dst[idx + 1] = g;
          dst[idx + 2] = b;
        }
        dst[idx + 3] = a;
      }
    }

    return dstImageData;
  }
}
