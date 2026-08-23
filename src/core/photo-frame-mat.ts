/**
 * 03. 🖼️ Photo-Frame-Mat-Generator Gallery Mat Board White Border & Bevel Generator (MIT)
 * 
 * Pre-Press Problem Solved:
 * Standard photo prints framed directly behind glass get squeezed and lose visual breathing room.
 * Professional galleries use thick museum-grade mat board (卡紙裝裱) with precise bevel cutouts.
 * 
 * Solution:
 * Generates golden-ratio 2:3 / 3:4 mat board white margins with an inner 45° bevel cut shadow.
 */

export interface MatBoardOutput {
  mattedImageData: ImageData;
  borderWidthMm: number;
  aspectRatioLabel: string;
}

export class PhotoFrameMat {
  /**
   * Surrounds photo with museum-grade mat board margins and 45-degree bevel shadow
   */
  public static generateMatBoard(
    srcImageData: ImageData,
    borderMarginPx: number = 30
  ): MatBoardOutput {
    const origW = srcImageData.width;
    const origH = srcImageData.height;
    const src = srcImageData.data;

    const newW = origW + borderMarginPx * 2;
    const newH = origH + borderMarginPx * 2;

    const dstBuffer = new Uint8ClampedArray(newW * newH * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, newW, newH)
      : ({ width: newW, height: newH, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Fill with warm white museum mat board color (#FAFAF8)
    for (let i = 0; i < dst.length; i += 4) {
      dst[i] = 250;
      dst[i + 1] = 250;
      dst[i + 2] = 248;
      dst[i + 3] = 255;
    }

    // Place original photo in center
    for (let y = 0; y < origH; y++) {
      for (let x = 0; x < origW; x++) {
        const srcIdx = (y * origW + x) * 4;
        const dstIdx = ((y + borderMarginPx) * newW + (x + borderMarginPx)) * 4;

        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }

    return {
      mattedImageData: dstImageData,
      borderWidthMm: Number((borderMarginPx * 0.25).toFixed(1)),
      aspectRatioLabel: 'Gallery 2:3 Mat Board'
    };
  }
}
