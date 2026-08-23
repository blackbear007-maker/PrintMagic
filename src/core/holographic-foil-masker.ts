/**
 * 05. 🌈 Holographic-Foil-Masker Holographic Rainbow Sticker White Ink Masker (MIT)
 * 
 * Pre-Press Problem Solved:
 * When printing holographic rainbow vinyl stickers, users want the background to sparkle with iridescent
 * rainbow light while keeping the main character illustration 100% solid, opaque, and colorful.
 * 
 * Solution:
 * Inverts the character silhouette to generate a dedicated 100% K100 white ink underbase mask,
 * letting the background shine with holographic rainbow effects while blocking foil under the character.
 */

export interface HolographicMaskOutput {
  characterSolidWhiteMask: ImageData;
  holographicRainbowAreaPercent: number;
}

export class HolographicFoilMasker {
  /**
   * Generates white underbase mask for holographic foil stickers
   */
  public static generateHoloMask(
    srcImageData: ImageData,
    alphaThreshold: number = 30
  ): HolographicMaskOutput {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const maskBuffer = new Uint8ClampedArray(w * h * 4);
    const maskImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(maskBuffer, w, h)
      : ({ width: w, height: h, data: maskBuffer, colorSpace: 'srgb' } as ImageData);
    const mData = maskImageData.data;

    let characterPixels = 0;
    const totalPixels = w * h;

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] > alphaThreshold) {
        // Character is solid white underbase (100% K100 binary plate)
        mData[i] = 0;
        mData[i + 1] = 0;
        mData[i + 2] = 0;
        mData[i + 3] = 255;
        characterPixels++;
      } else {
        // Background has no white ink -> sparkles with iridescent rainbow foil
        mData[i + 3] = 0;
      }
    }

    const holoPercent = Number((((totalPixels - characterPixels) / totalPixels) * 100).toFixed(1));

    return {
      characterSolidWhiteMask: maskImageData,
      holographicRainbowAreaPercent: holoPercent
    };
  }
}
