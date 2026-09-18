/**
 * 🎨 Directional Line-Art Upscaler (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * Bilinear expansion plus a dark-line contrast push along luminance edges. It is inspired by the
 * Anime4K project's general goal (crisp ink lines when upscaling flat-color illustration) but is
 * an independent, much simpler reimplementation — not the Anime4K shader pipeline itself, and
 * carries no affiliation with or license from that project.
 */

import { createImageData } from './image-data-factory';

export class LineArtUpscaler {
  /**
   * Upscales flat-color illustration art with a directional dark-line contrast push
   */
  public static upscaleAnime(
    srcImageData: ImageData,
    scale: 1 | 2 | 4 = 2
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const dstW = w * scale;
    const dstH = h * scale;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(dstW * dstH * 4);
    const dstImageData: ImageData = createImageData(dstBuffer, dstW, dstH);
    const dst = dstImageData.data;

    // 1. Bilinear expansion (centre-aligned; scale 1 is a straight copy, alpha included)
    if (scale === 1) {
      dst.set(src);
    } else {
      for (let y = 0; y < dstH; y++) {
        const srcY = Math.min(h - 1, Math.max(0, (y + 0.5) / scale - 0.5));
        const y0 = Math.floor(srcY);
        const y1 = Math.min(h - 1, y0 + 1);
        const dy = srcY - y0;

        for (let x = 0; x < dstW; x++) {
          const srcX = Math.min(w - 1, Math.max(0, (x + 0.5) / scale - 0.5));
          const x0 = Math.floor(srcX);
          const x1 = Math.min(w - 1, x0 + 1);
          const dx = srcX - x0;

          const idx00 = (y0 * w + x0) * 4;
          const idx01 = (y0 * w + x1) * 4;
          const idx10 = (y1 * w + x0) * 4;
          const idx11 = (y1 * w + x1) * 4;

          const dstIdx = (y * dstW + x) * 4;

          for (let c = 0; c < 4; c++) {
            const val =
              (1 - dx) * (1 - dy) * src[idx00 + c] +
              dx * (1 - dy) * src[idx01 + c] +
              (1 - dx) * dy * src[idx10 + c] +
              dx * dy * src[idx11 + c];

            dst[dstIdx + c] = Math.min(255, Math.max(0, Math.round(val)));
          }
        }
      }
    }

    // 2. Dark line-art edge push: darken pixels sitting on a high-contrast boundary.
    // Luminance is read from an untouched snapshot so the darkening doesn't cascade.
    const ref = dst.slice();
    const lumAt = (i: number) => 0.299 * ref[i] + 0.587 * ref[i + 1] + 0.114 * ref[i + 2];
    for (let y = 1; y < dstH - 1; y++) {
      for (let x = 1; x < dstW - 1; x++) {
        const idx = (y * dstW + x) * 4;
        if (ref[idx + 3] === 0) continue; // fully transparent: nothing to ink
        const lumCenter = lumAt(idx);

        // Check if on a dark line boundary (<140 luminance)
        if (lumCenter < 140) {
          const lumTop = lumAt(((y - 1) * dstW + x) * 4);
          const lumBot = lumAt(((y + 1) * dstW + x) * 4);
          const lumL = lumAt((y * dstW + (x - 1)) * 4);
          const lumR = lumAt((y * dstW + (x + 1)) * 4);

          const maxNeighbor = Math.max(lumTop, lumBot, lumL, lumR);
          if (maxNeighbor - lumCenter > 40) {
            // Sharpen ink contour
            dst[idx] = Math.max(0, ref[idx] - 25);
            dst[idx + 1] = Math.max(0, ref[idx + 1] - 25);
            dst[idx + 2] = Math.max(0, ref[idx + 2] - 25);
          }
        }
      }
    }

    return dstImageData;
  }
}
