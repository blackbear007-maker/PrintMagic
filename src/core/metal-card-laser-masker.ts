/**
 * 16. 💳 Metal-Card-Laser-Masker Black Metal Card Laser Marking / Copper Reveal Masker (MIT)
 * 
 * Pre-Press Problem Solved:
 * Creating luxury anodized matte black aluminum/stainless steel business cards requires generating
 * an isolated 100% K100 binary mask for fiber laser engraving machines to burn away the black anodized
 * coating and reveal the raw silver/copper metal underneath.
 * 
 * Solution:
 * Converts text, logos, and QR codes into an ultra-sharp 100% K100 vector laser marking plate.
 */

export class MetalCardLaserMasker {
  /**
   * Generates 100% K100 binary laser etching mask for black anodized metal cards
   */
  public static generateMetalLaserMask(
    srcImageData: ImageData,
    edgeSensitivity: number = 128
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let i = 0; i < src.length; i += 4) {
      const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];

      if (lum > edgeSensitivity && src[i + 3] > 60) {
        // Laser Etch / Metal Reveal Area (100% K100 plate)
        dst[i] = 0;
        dst[i + 1] = 0;
        dst[i + 2] = 0;
        dst[i + 3] = 255;
      } else {
        // Untouched Anodized Black Metal (Transparent)
        dst[i + 3] = 0;
      }
    }

    return dstImageData;
  }
}
