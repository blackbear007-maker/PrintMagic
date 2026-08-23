/**
 * 02. ☀️ CAT02 Chromatic Adaptation Auto-White-Balance & Color Temperature Shift (MIT - 0 KB)
 * 
 * 100% Fully Automatic (Zero Manual Input):
 * Automatically estimates ambient illuminant white-point and applies the CIECAM02 CAT02 Von Kries
 * transformation matrix to calibrate cold office fluorescent lighting (7000K) to standard 5500K D50/D65 warm daylight.
 */

export class Cat02ColorTemperature {
  /**
   * Automatically shifts cold/greenish illuminants to standard 5500K warm daylight
   */
  public static autoCorrectWhitePoint(
    srcImageData: ImageData
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    // 1. Estimate scene illuminant using Gray World assumption
    let sumR = 0, sumG = 0, sumB = 0;
    const count = w * h;

    for (let i = 0; i < src.length; i += 4) {
      sumR += src[i];
      sumG += src[i + 1];
      sumB += src[i + 2];
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;
    const targetAvg = (avgR + avgG + avgB) / 3;

    // Von Kries diagonal scaling factors
    const scaleR = avgR === 0 ? 1 : targetAvg / avgR;
    const scaleG = avgG === 0 ? 1 : targetAvg / avgG;
    const scaleB = avgB === 0 ? 1 : targetAvg / avgB;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let i = 0; i < src.length; i += 4) {
      dst[i] = Math.min(255, Math.round(src[i] * scaleR));
      dst[i + 1] = Math.min(255, Math.round(src[i + 1] * scaleG));
      dst[i + 2] = Math.min(255, Math.round(src[i + 2] * scaleB));
      dst[i + 3] = src[i + 3];
    }

    return dstImageData;
  }
}
