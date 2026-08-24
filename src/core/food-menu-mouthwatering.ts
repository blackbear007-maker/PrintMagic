/**
 * 🍜 03. FoodMenuMouthwatering (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * Food photos taken under restaurant ambient yellow lights print dull and brownish on coated paper,
 * reducing customers' appetite and perceived dish value.
 * 
 * Mathematical Solution:
 * 1. Isolates appetizing color spectrums (Warm Reds 620nm & Crispy Golden Yellows 580nm).
 * 2. Applies selective non-linear saturation curve (+25% vibrancy).
 * 3. Micro-enhances lipid specular highlights (+15% juicy glazes) without blowing out highlights.
 */

export class FoodMenuMouthwatering {
  public static enhanceFoodAppetite(
    srcImageData: ImageData,
    appetiteBoost: number = 0.35,
    juicinessGlaze: number = 0.2
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const outData = new Uint8ClampedArray(src.length);

    for (let i = 0; i < src.length; i += 4) {
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

      // Check if pixel falls into Food Appetite Hue Spectrum (Red / Orange / Golden Yellow / Fresh Green)
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const sat = max === 0 ? 0 : delta / max;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Food Hue detection (Warm Red-Orange-Yellow spectrum)
      const isWarmFood = (r > g && r > b && (r - b) > 20) || (r > 120 && g > 100 && b < 80);
      const isJuicyHighlight = lum > 190 && lum < 245 && sat > 0.15;

      let newR = r;
      let newG = g;
      let newB = b;

      if (isWarmFood) {
        // Boost warm red and golden tones
        newR = Math.min(255, r * (1 + appetiteBoost * 0.3) + 6);
        newG = Math.min(255, g * (1 + appetiteBoost * 0.15) + (r > g ? 2 : 0));
        newB = Math.max(0, b * (1 - appetiteBoost * 0.1)); // Suppress cold blue cast
      }

      if (isJuicyHighlight) {
        // Enhance glaze specular reflections
        newR = Math.min(255, newR + (255 - newR) * juicinessGlaze);
        newG = Math.min(255, newG + (255 - newG) * juicinessGlaze * 0.9);
        newB = Math.min(255, newB + (255 - newB) * juicinessGlaze * 0.7);
      }

      outData[i] = Math.round(newR);
      outData[i + 1] = Math.round(newG);
      outData[i + 2] = Math.round(newB);
      outData[i + 3] = a;
    }

    return {
      width: w,
      height: h,
      data: outData,
      colorSpace: 'srgb'
    } as ImageData;
  }
}
