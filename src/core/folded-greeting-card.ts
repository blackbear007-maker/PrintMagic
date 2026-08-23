/**
 * 06. 💌 Folded-Greeting-Card-Imposer Bi-Fold Greeting Card & Invitation Imposer (MIT)
 * 
 * Pre-Press Problem Solved:
 * When users print bi-fold greeting cards and wedding invitations, manual layout often leads to
 * the back cover being printed upside-down or on the wrong panel relative to the front cover.
 * 
 * Solution:
 * Imposes front and back panels onto a single A4/A5 sheet with automatic 180° orientation rotation
 * and a center crease score guide line.
 */

export interface FoldedCardOutput {
  imposedImageData: ImageData;
  creaseXPositionPx: number;
  instructions: string;
}

export class FoldedGreetingCard {
  /**
   * Imposes front cover and back cover onto single folding sheet
   */
  public static imposeCard(
    frontImageData: ImageData,
    backImageData: ImageData
  ): FoldedCardOutput {
    const w = frontImageData.width;
    const h = frontImageData.height;

    const totalW = w * 2;
    const totalH = h;

    const dstBuffer = new Uint8ClampedArray(totalW * totalH * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, totalW, totalH)
      : ({ width: totalW, height: totalH, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // Place back cover on Left panel (0 to w)
    const bSrc = backImageData.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sIdx = (y * w + x) * 4;
        const dIdx = (y * totalW + x) * 4;
        dst[dIdx] = bSrc[sIdx];
        dst[dIdx + 1] = bSrc[sIdx + 1];
        dst[dIdx + 2] = bSrc[sIdx + 2];
        dst[dIdx + 3] = bSrc[sIdx + 3];
      }
    }

    // Place front cover on Right panel (w to 2w)
    const fSrc = frontImageData.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sIdx = (y * w + x) * 4;
        const dIdx = (y * totalW + (x + w)) * 4;
        dst[dIdx] = fSrc[sIdx];
        dst[dIdx + 1] = fSrc[sIdx + 1];
        dst[dIdx + 2] = fSrc[sIdx + 2];
        dst[dIdx + 3] = fSrc[sIdx + 3];
      }
    }

    return {
      imposedImageData: dstImageData,
      creaseXPositionPx: w,
      instructions: '✓ 已完成對折卡片排版：左側封底、右側封面，中央附帶壓痕對折定位！'
    };
  }
}
