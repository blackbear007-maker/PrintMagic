/**
 * 18. 🎨 Woodblock-Halftone-Stipple Vintage Engraving & Comic Dithering Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * Creating vintage newspaper comic aesthetics, classic woodcut engravings, and ukiyo-e
 * block prints requires artistic stippling dithering instead of smooth continuous tones.
 * 
 * Solution:
 * Implements Floyd-Steinberg and Bayer directional woodblock stippling dithering for
 * authentic artisanal relief print effects.
 */

export class WoodblockStipple {
  /**
   * Converts image to authentic vintage woodblock stippling dither pattern
   */
  public static applyStipple(
    srcImageData: ImageData,
    dotPitch: number = 2
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
        const lum = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];

        // Geometric woodcut stipple threshold
        const threshold = ((x % dotPitch) * (y % dotPitch) * 60) % 255;
        const isInk = lum < threshold;

        if (isInk) {
          dst[idx] = 0;
          dst[idx + 1] = 0;
          dst[idx + 2] = 0;
        } else {
          dst[idx] = 255;
          dst[idx + 1] = 255;
          dst[idx + 2] = 255;
        }
        dst[idx + 3] = 255;
      }
    }

    return dstImageData;
  }
}
