/**
 * 🏛️ 05. FlatFieldVignetteCorrector (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * Wide-angle architectural photos, real estate brochures, and landscape postcards have
 * noticeable lens falloff (cos^4 theta optical vignetting) in the 4 corners,
 * which print as heavy, muddy dark black blobs in CMYK.
 * 
 * Mathematical Solution:
 * 1. Computes normalized radial distance r from image optical center (cx, cy) to outer corners (r in 0~1.0).
 * 2. Applies inverse flat-field optical gain function: G(r) = 1 + strength * r^2.5.
 * 3. Smoothly raises corner exposure while preserving chromatic balance and preventing highlight blowouts.
 */

export class FlatFieldVignetteCorrector {
  public static correctVignetteFalloff(
    srcImageData: ImageData,
    correctionGain: number = 0.35,
    radialFalloffPower: number = 2.4
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const outData = new Uint8ClampedArray(src.length);

    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = Math.sqrt(cx * cx + cy * cy);

    for (let y = 0; y < h; y++) {
      const dy = y - cy;
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const i = (y * w + x) * 4;

        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const a = src[i + 3];

        if (a < 50) {
          outData[i] = r;
          outData[i + 1] = g;
          outData[i + 2] = b;
          outData[i + 3] = a;
          continue;
        }

        // Normalized radial distance from center
        const radius = Math.sqrt(dx * dx + dy * dy);
        const normR = Math.min(1.0, radius / maxRadius);

        // Inverse Optical Falloff Gain
        const gain = 1.0 + correctionGain * Math.pow(normR, radialFalloffPower);

        outData[i] = Math.min(255, Math.max(0, Math.round(r * gain)));
        outData[i + 1] = Math.min(255, Math.max(0, Math.round(g * gain)));
        outData[i + 2] = Math.min(255, Math.max(0, Math.round(b * gain)));
        outData[i + 3] = a;
      }
    }

    return {
      width: w,
      height: h,
      data: outData,
      colorSpace: 'srgb'
    } as ImageData;
  }
}
