/**
 * 10. 🖤 Floyd-Steinberg 1-Bit Error Diffusion Halftone Rasterizer (MIT - 0 KB)
 * 
 * 100% Fully Automatic (Zero Manual Input):
 * Applies spatial error diffusion dithering (7/16, 3/16, 5/16, 1/16) to transform continuous-tone
 * photos into rich newspaper-style dot halftones optimized for 1-bit thermal and convenience store black-and-white copiers.
 */

export class FloydSteinbergRasterizer {
  /**
   * Automatically rasterizes continuous tones into crisp 1-bit black & white dot halftones
   */
  public static rasterize1Bit(
    srcImageData: ImageData
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const gray = new Float32Array(w * h);
    for (let i = 0; i < src.length; i += 4) {
      gray[i / 4] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    }

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const oldVal = gray[idx];
        const newVal = oldVal < 128 ? 0 : 255;
        const err = oldVal - newVal;

        const dIdx = idx * 4;
        dst[dIdx] = newVal;
        dst[dIdx + 1] = newVal;
        dst[dIdx + 2] = newVal;
        dst[dIdx + 3] = 255;

        // Distribute error
        if (x + 1 < w) gray[idx + 1] += err * (7 / 16);
        if (x - 1 >= 0 && y + 1 < h) gray[(y + 1) * w + (x - 1)] += err * (3 / 16);
        if (y + 1 < h) gray[(y + 1) * w + x] += err * (5 / 16);
        if (x + 1 < w && y + 1 < h) gray[(y + 1) * w + (x + 1)] += err * (1 / 16);
      }
    }

    return dstImageData;
  }
}
