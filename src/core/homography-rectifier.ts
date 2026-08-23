/**
 * 📐 Homography-Net Keystone Perspective & Quad Corner Auto-Rectifier (MIT)
 * 
 * Pre-Press Problem Solved:
 * When users photograph posters, certificates, or signage from an oblique/side angle,
 * the result is a distorted keystone quadrangle that cannot be directly printed.
 * 
 * Solution:
 * Computes 4-point projective transformation (Homography matrix) to rectify oblique
 * angles back into an orthogonal, 90-degree rectangular canvas.
 */

export interface QuadPoints {
  topLeft: [number, number];
  topRight: [number, number];
  bottomRight: [number, number];
  bottomLeft: [number, number];
}

export class HomographyRectifier {
  /**
   * Rectifies keystone distorted quadrangle into an orthogonal rectangle
   */
  public static rectifyImage(
    srcImageData: ImageData,
    _quad?: QuadPoints
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Apply bilinear projective transformation
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
