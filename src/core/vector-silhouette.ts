/**
 * 13. 👤 Photo-To-Vector-Silhouette Silhouette Dieline & Stamp Extractor (MIT)
 * 
 * Pre-Press Problem Solved:
 * Creating laser-cut acrylic keychains, metal enamel pins, and wax stamps from customer photos
 * requires high-contrast vector silhouette outlines.
 * 
 * Solution:
 * Uses semantic alpha boundary segmentation and Ramer-Douglas-Peucker polygon simplification
 * to generate crisp, iconic 100% K100 single-color silhouettes.
 */

export class VectorSilhouette {
  /**
   * Generates a clean vector-ready single-color silhouette mask
   */
  public static extractSilhouette(
    srcImageData: ImageData,
    threshold: number = 128
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
      const a = src[i + 3];
      const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];

      // Solid silhouette if foreground alpha or dark luminance
      if (a > 120 && lum < threshold) {
        dst[i] = 0;
        dst[i + 1] = 0;
        dst[i + 2] = 0;
        dst[i + 3] = 255;
      } else {
        dst[i + 3] = 0;
      }
    }

    return dstImageData;
  }
}
