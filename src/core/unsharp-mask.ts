/**
 * Professional Pre-press Unsharp Mask (USM) Filter
 * Standard pre-press pre-emphasis to compensate for physical ink absorption and dot gain
 */
export class UnsharpMask {
  public static readonly DEFAULT_AMOUNT = 1.5; // 150%
  public static readonly DEFAULT_RADIUS = 1; // 1px radius
  public static readonly DEFAULT_THRESHOLD = 3; // noise protection threshold

  /**
   * Apply unsharp mask sharpening to ImageData
   */
  public static apply(
    imageData: ImageData,
    amount: number = this.DEFAULT_AMOUNT,
    radius: number = this.DEFAULT_RADIUS,
    threshold: number = this.DEFAULT_THRESHOLD
  ): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = new ImageData(
      new Uint8ClampedArray(src),
      width,
      height
    );
    const dst = output.data;

    // Fast Separable Box Blur Approximation for Radius
    const blurred = this.boxBlur(src, width, height, radius);

    for (let i = 0; i < src.length; i += 4) {
      // Retain alpha unchanged
      dst[i + 3] = src[i + 3];

      for (let c = 0; c < 3; c++) {
        const orig = src[i + c];
        const blur = blurred[i + c];
        const diff = orig - blur;

        if (Math.abs(diff) >= threshold) {
          const sharpened = orig + diff * amount;
          dst[i + c] = Math.min(255, Math.max(0, Math.round(sharpened)));
        } else {
          dst[i + c] = orig;
        }
      }
    }

    return output;
  }

  /**
   * Fast Box Blur pass
   */
  private static boxBlur(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    r: number
  ): Uint8ClampedArray {
    const out = new Uint8ClampedArray(data.length);
    const temp = new Uint8ClampedArray(data.length);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) {
            const idx = (y * width + nx) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count++;
          }
        }
        const idx = (y * width + x) * 4;
        temp[idx] = sumR / count;
        temp[idx + 1] = sumG / count;
        temp[idx + 2] = sumB / count;
      }
    }

    // Vertical pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = -r; dy <= r; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < height) {
            const idx = (ny * width + x) * 4;
            sumR += temp[idx];
            sumG += temp[idx + 1];
            sumB += temp[idx + 2];
            count++;
          }
        }
        const idx = (y * width + x) * 4;
        out[idx] = sumR / count;
        out[idx + 1] = sumG / count;
        out[idx + 2] = sumB / count;
      }
    }

    return out;
  }
}
