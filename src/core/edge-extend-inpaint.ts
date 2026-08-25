/**
 * 🎨 Mirror-Extend Bleed Generator (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * Reflects the source image's edge pixels outward to fill the bleed margin. It is not the LaMa
 * inpainting network (no Fourier-convolution content synthesis, no learned inpainting) — it works
 * well for images with a fairly uniform or repeating edge texture, and looks obviously mirrored on
 * images with distinct edge content (faces, text, sharp objects near the border).
 */

export interface EdgeExtendBleedResult {
  expandedImageData: ImageData;
  bleedWidthPx: number;
  bleedTop: number;
  bleedBottom: number;
  bleedLeft: number;
  bleedRight: number;
}

export class EdgeExtendInpainter {
  /**
   * Generates a 3mm bleed extension around an artwork by mirroring edge pixels outward
   */
  public static generateBleedMargin(
    srcImageData: ImageData,
    bleedPx: number = 36 // 3mm @ 300 DPI is approx 35.4 px
  ): EdgeExtendBleedResult {
    const srcW = srcImageData.width;
    const srcH = srcImageData.height;
    const src = srcImageData.data;

    const outW = srcW + bleedPx * 2;
    const outH = srcH + bleedPx * 2;
    const outData = new Uint8ClampedArray(outW * outH * 4);

    // 1. Copy original image into inner center
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = (y * srcW + x) * 4;
        const outIdx = ((y + bleedPx) * outW + (x + bleedPx)) * 4;

        outData[outIdx] = src[srcIdx];
        outData[outIdx + 1] = src[srcIdx + 1];
        outData[outIdx + 2] = src[srcIdx + 2];
        outData[outIdx + 3] = src[srcIdx + 3];
      }
    }

    // 2. Mirror-reflect edge pixels outward into the bleed margin
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        // Skip inner original content
        if (x >= bleedPx && x < srcW + bleedPx && y >= bleedPx && y < srcH + bleedPx) {
          continue;
        }

        const outIdx = (y * outW + x) * 4;

        // Symmetric reflection coordinates
        let srcX = x - bleedPx;
        let srcY = y - bleedPx;

        if (srcX < 0) srcX = Math.abs(srcX) - 1;
        else if (srcX >= srcW) srcX = srcW - 1 - (srcX - srcW);

        if (srcY < 0) srcY = Math.abs(srcY) - 1;
        else if (srcY >= srcH) srcY = srcH - 1 - (srcY - srcH);

        srcX = Math.max(0, Math.min(srcW - 1, srcX));
        srcY = Math.max(0, Math.min(srcH - 1, srcY));

        const srcIdx = (srcY * srcW + srcX) * 4;

        outData[outIdx] = src[srcIdx];
        outData[outIdx + 1] = src[srcIdx + 1];
        outData[outIdx + 2] = src[srcIdx + 2];
        outData[outIdx + 3] = 255;
      }
    }

    const expandedImageData = {
      width: outW,
      height: outH,
      data: outData,
      colorSpace: 'srgb'
    } as ImageData;

    return {
      expandedImageData,
      bleedWidthPx: bleedPx,
      bleedTop: bleedPx,
      bleedBottom: bleedPx,
      bleedLeft: bleedPx,
      bleedRight: bleedPx
    };
  }
}
