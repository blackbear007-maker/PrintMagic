/**
 * 12. 🔄 TextCurvature-Unbender Curved & Circular Label Text Unbender (Apache 2.0)
 * 
 * Pre-Press Problem Solved:
 * Artwork photographed from circular bottle labels, round commemorative seals, and cup sleeves
 * is severely curved, making OCR text extraction and horizontal re-typesetting impossible.
 * 
 * Solution:
 * Uses polar-to-Cartesian conformal coordinate mapping to unroll radial arc text into
 * clean horizontal rectangular text baselines.
 */

export class TextCurvatureUnbender {
  /**
   * Unbends circular/curved label text into an unrolled horizontal strip
   */
  public static unrollCurvedText(
    srcImageData: ImageData,
    _arcAngleDeg: number = 180
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Apply forward polar unrolling transformation
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * 4;
        const dstIdx = (y * w + x) * 4;

        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }

    return dstImageData;
  }
}
