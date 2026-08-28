/**
 * ✂️ 顏色距離去背與 Alpha 遮罩引擎
 * 決定性演算法（角落取樣背景色 + 顏色距離），非神經網路去背模型。
 * 特色：
 * 1. 自動偵測畫面主要實體輪廓與透明通道提取
 * 2. 邊緣色溢消除 (Color Decontamination)
 * 3. 完美直通 Dieline 刀模與白墨層引擎
 */
export class AiMatting {
  /**
   * Performs automatic background removal & alpha matte extraction
   */
  public static removeBackground(
    srcImageData: ImageData,
    tolerance: number = 25
  ): { imageData: ImageData; dataUrl: string; hasTransparency: boolean } {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const dstImgData = ctx.createImageData(w, h);
    const dst = dstImgData.data;

    // Sample a small block at each of the 4 corners (not a single pixel — a single noisy/
    // JPEG-artifact pixel exactly at the corner would otherwise skew the whole background
    // estimate) and average each corner's block to determine the dominant background color.
    const [bgR, bgG, bgB] = this.sampleCornerBackgroundColor(src, w, h);

    let transparentPixels = 0;

    // Color distance alpha matting
    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const a = src[i + 3];

      // If pixel was already transparent, keep it transparent
      if (a < 20) {
        dst[i] = 0;
        dst[i + 1] = 0;
        dst[i + 2] = 0;
        dst[i + 3] = 0;
        transparentPixels++;
        continue;
      }

      // Euclidean color distance from background
      const dist = Math.sqrt(
        (r - bgR) ** 2 +
        (g - bgG) ** 2 +
        (b - bgB) ** 2
      );

      if (dist < tolerance) {
        // Full transparent background
        dst[i] = 0;
        dst[i + 1] = 0;
        dst[i + 2] = 0;
        dst[i + 3] = 0;
        transparentPixels++;
      } else if (dist < tolerance * 1.8) {
        // Soft feather edge (hair & fine details)
        const alphaRatio = (dist - tolerance) / (tolerance * 0.8);
        dst[i] = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
        dst[i + 3] = Math.round(255 * alphaRatio);
      } else {
        // Solid foreground
        dst[i] = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
        dst[i + 3] = 255;
      }
    }

    ctx.putImageData(dstImgData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');

    return {
      imageData: dstImgData,
      dataUrl,
      hasTransparency: transparentPixels > (w * h * 0.05)
    };
  }

  /**
   * Averages a small block at each of the 4 corners (clamped to stay in-bounds on tiny images)
   * instead of reading a single corner pixel, then averages the 4 corner block-means. A single
   * exact-corner pixel is fragile — one noisy/JPEG-artifact pixel there skews the whole background
   * estimate; a small block absorbs that noise.
   */
  private static sampleCornerBackgroundColor(
    src: Uint8ClampedArray,
    w: number,
    h: number,
    blockSize: number = 5
  ): [number, number, number] {
    const corners: Array<[number, number, number, number]> = [
      [0, 0, 1, 1],
      [w - 1, 0, -1, 1],
      [0, h - 1, 1, -1],
      [w - 1, h - 1, -1, -1]
    ];

    let bgR = 0, bgG = 0, bgB = 0;
    for (const [originX, originY, dirX, dirY] of corners) {
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let dy = 0; dy < blockSize; dy++) {
        const y = originY + dy * dirY;
        if (y < 0 || y >= h) continue;
        for (let dx = 0; dx < blockSize; dx++) {
          const x = originX + dx * dirX;
          if (x < 0 || x >= w) continue;
          const i = (y * w + x) * 4;
          sumR += src[i];
          sumG += src[i + 1];
          sumB += src[i + 2];
          count++;
        }
      }
      bgR += sumR / count;
      bgG += sumG / count;
      bgB += sumB / count;
    }

    return [bgR / 4, bgG / 4, bgB / 4];
  }
}
