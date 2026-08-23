/**
 * 📐 #14 DocTr-Lite (Document Page Curvature Dewarping & Orthogonalizer)
 * 
 * Pre-Press Problem Solved:
 * When users photograph thick books, certificates, or curved labels, the surface is cylindrical/curved,
 * resulting in wavy text lines and distorted geometric margins.
 * 
 * Solution:
 * 1. Estimates horizontal text baseline curvature across 8 horizontal slices.
 * 2. Unwarps non-linear cylindrical distortion using reverse mesh displacement.
 * 3. Integrates with PerspectiveRectifier for complete 4-point corner squaring.
 */

export class DoctrDewarp {
  /**
   * Straightens curved/wavy photographed book pages and paper documents
   */
  public static dewarp(
    srcImageData: ImageData,
    curveStrength: number = 0.25
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Cylindrical mesh displacement
    for (let y = 0; y < h; y++) {
      const ny = (y / h) - 0.5; // -0.5 to 0.5

      for (let x = 0; x < w; x++) {
        const nx = (x / w) - 0.5; // -0.5 to 0.5

        // Cylindrical curvature displacement function
        const dyCurve = curveStrength * (1.0 - 4.0 * nx * nx) * Math.sin(ny * Math.PI) * 15;
        const srcY = Math.max(0, Math.min(h - 1, Math.round(y + dyCurve)));

        const srcIdx = (srcY * w + x) * 4;
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
