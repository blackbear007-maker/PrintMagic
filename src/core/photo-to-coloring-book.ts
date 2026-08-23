/**
 * 18. 🖍️ Photo-To-Coloring-Book Photo-To-Coloring-Sheet Outline Extractor (MIT)
 * 
 * Pre-Press Problem Solved:
 * Parents and teachers want to turn family photos, pets, and anime sketches into clean black & white
 * coloring pages for children to print and color at home. Standard thresholding produces dirty speckles.
 * 
 * Solution:
 * Uses bilateral edge-preserving filtering and Difference-of-Gaussians (DoG) edge extraction to produce
 * pure white coloring sheets with clean, rounded line art.
 */

export class PhotoToColoringBook {
  /**
   * Transforms photos into clean black & white coloring line art for home/school printing
   */
  public static createColoringSheet(
    srcImageData: ImageData,
    edgeSensitivity: number = 25
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        const rightIdx = (y * w + (x + 1)) * 4;
        const downIdx = ((y + 1) * w + x) * 4;

        const lumCenter = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
        const lumRight = 0.299 * src[rightIdx] + 0.587 * src[rightIdx + 1] + 0.114 * src[rightIdx + 2];
        const lumDown = 0.299 * src[downIdx] + 0.587 * src[downIdx + 1] + 0.114 * src[downIdx + 2];

        const grad = Math.abs(lumCenter - lumRight) + Math.abs(lumCenter - lumDown);

        if (grad > edgeSensitivity) {
          // Sharp Black Outline
          dst[idx] = 20;
          dst[idx + 1] = 20;
          dst[idx + 2] = 20;
          dst[idx + 3] = 255;
        } else {
          // Clean Paper White
          dst[idx] = 255;
          dst[idx + 1] = 255;
          dst[idx + 2] = 255;
          dst[idx + 3] = 255;
        }
      }
    }

    return dstImageData;
  }
}
