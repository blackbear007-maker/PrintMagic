/**
 * 02. 🖼️ Canvas-Wrap-Mirror-Builder 4-Sided 3D Canvas Wrap Mirror Bleed Generator (MIT)
 * 
 * Pre-Press Problem Solved:
 * When framing gallery canvas prints (3cm thick stretcher bars), naive wrapping folds the front image
 * around the sides, cutting off 3cm of the subject's head or edges. Leaving white borders looks unfinished.
 * 
 * Solution:
 * Extends all 4 perimeter borders outwards by 3.5cm using continuous mirror reflection, preserving
 * 100% of the front canvas composition while seamlessly wrapping the edges.
 */

export class CanvasWrapMirror {
  /**
   * Generates 4-sided mirror bleed borders for thick wooden canvas frames
   */
  public static generateCanvasWrap(
    srcImageData: ImageData,
    wrapDepthPx: number = 35
  ): ImageData {
    const origW = srcImageData.width;
    const origH = srcImageData.height;
    const src = srcImageData.data;

    const newW = origW + wrapDepthPx * 2;
    const newH = origH + wrapDepthPx * 2;

    const dstBuffer = new Uint8ClampedArray(newW * newH * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, newW, newH)
      : ({ width: newW, height: newH, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        let srcX = x - wrapDepthPx;
        let srcY = y - wrapDepthPx;

        // Mirror X
        if (srcX < 0) srcX = -srcX;
        else if (srcX >= origW) srcX = 2 * origW - 1 - srcX;

        // Mirror Y
        if (srcY < 0) srcY = -srcY;
        else if (srcY >= origH) srcY = 2 * origH - 1 - srcY;

        srcX = Math.max(0, Math.min(origW - 1, srcX));
        srcY = Math.max(0, Math.min(origH - 1, srcY));

        const srcIdx = (srcY * origW + srcX) * 4;
        const dstIdx = (y * newW + x) * 4;

        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }

    return dstImageData;
  }
}
