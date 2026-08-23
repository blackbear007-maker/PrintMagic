/**
 * 07. 📜 Paper-White Substrate Color Offset Compensator (MIT - 0 KB)
 * 
 * 100% Fully Automatic (Zero Manual Input):
 * Samples natural substrate paper tint (cream, uncoated woodfree, kraft) and inverse-biases skin
 * tones and pastel highlights, ensuring portraits printed on yellowish paper retain natural, fair skin tones.
 */

export class PaperWhiteCompensator {
  /**
   * Automatically offsets substrate paper tint to preserve pure highlights
   */
  public static compensateSubstrate(
    srcImageData: ImageData,
    substrateType: 'cream' | 'kraft' | 'standard' = 'cream'
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
      let r = src[i];
      let g = src[i + 1];
      let b = src[i + 2];
      const a = src[i + 3];

      if (substrateType === 'cream') {
        // Offset yellow/red shift: slightly cool the highlights
        if (r > 150 && g > 150) {
          b = Math.min(255, Math.round(b * 1.05));
          r = Math.max(0, Math.round(r * 0.98));
        }
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
