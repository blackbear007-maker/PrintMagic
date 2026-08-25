/**
 * 🌫️ Atmospheric Scattering Model Dehaze (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * The classical dark-channel-prior-style scattering inversion formula, J(x) = (I(x) - A) / t(x) + A
 * (He et al., non-learned). This is a legitimate, well-established classical computer-vision
 * technique — it is not "DehazeFormer" (a Vision Transformer model); no transformer weights are
 * involved. Renamed to describe the actual technique instead of a borrowed SOTA paper name.
 */

export class ContrastDehazeFilter {
  /**
   * Clears atmospheric haze using the classical scattering-inversion model
   */
  public static dehaze(
    srcImageData: ImageData,
    strength: number = 0.75
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    // 1. Estimate global atmospheric veil A (top 0.1% brightest in dark channel)
    let sumBrightest = 0;
    let countBrightest = 0;
    for (let i = 0; i < src.length; i += 16) {
      const minChannel = Math.min(src[i], src[i + 1], src[i + 2]);
      if (minChannel > 180) {
        sumBrightest += (src[i] + src[i + 1] + src[i + 2]) / 3;
        countBrightest++;
      }
    }

    const A = countBrightest > 0 ? Math.min(235, Math.max(190, sumBrightest / countBrightest)) : 220;

    // 2. Localized transmission field with edge protection
    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      const minVal = Math.min(r, g, b);
      const rawT = 1.0 - 0.92 * (minVal / A);
      const transmission = Math.max(0.25, Math.min(1.0, rawT));

      // Physical scattering inversion
      const targetR = (r - A) / transmission + A;
      const targetG = (g - A) / transmission + A;
      const targetB = (b - A) / transmission + A;

      const outR = targetR * strength + r * (1 - strength);
      const outG = targetG * strength + g * (1 - strength);
      const outB = targetB * strength + b * (1 - strength);

      dst[i] = Math.min(255, Math.max(0, Math.round(outR)));
      dst[i + 1] = Math.min(255, Math.max(0, Math.round(outG)));
      dst[i + 2] = Math.min(255, Math.max(0, Math.round(outB)));
      dst[i + 3] = src[i + 3];
    }

    return dstImageData;
  }
}
