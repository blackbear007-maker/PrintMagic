/**
 * 🎨 RisoSeparator Screen Printing & Risograph Spot Color Plate Separator (MIT)
 * 
 * Pre-Press Problem Solved:
 * Screen printing (T-Shirts, apparel, tote bags) and Risograph stencil printing cannot print
 * standard 4-color continuous CMYK. They require artwork separated into 2~6 discrete spot color
 * ink drums (e.g. Fluorescent Pink, Aqua Blue, Sunflower, Black).
 * 
 * Solution:
 * Performs color quantization and ink channel decomposition to export individual monochrome
 * separation films (positives) ready for screen exposure / stencil masters.
 */

export interface SpotColorPlate {
  plateIndex: number;
  inkName: string;
  hexColor: string;
  plateImageData: ImageData;
  coveragePercent: number;
}

export class RisoSeparator {
  /**
   * Separates an image into discrete spot color printing plates
   */
  public static separatePlates(
    srcImageData: ImageData,
    colorCount: number = 3
  ): SpotColorPlate[] {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const totalPixels = w * h;

    const defaultInks = [
      { name: 'Risograph 漆黑 (Black)', hex: '#000000' },
      { name: 'Risograph 螢光粉 (Fluorescent Pink)', hex: '#FF48B0' },
      { name: 'Risograph 水藍 (Aqua Blue)', hex: '#00A3FF' },
      { name: 'Risograph 芥末黃 (Sunflower)', hex: '#FFB800' },
      { name: 'Risograph 翠綠 (Kelly Green)', hex: '#00A95C' }
    ];

    const plates: SpotColorPlate[] = [];
    const count = Math.min(colorCount, defaultInks.length);

    for (let p = 0; p < count; p++) {
      const buffer = new Uint8ClampedArray(w * h * 4);
      const plateImg: ImageData = typeof ImageData !== 'undefined'
        ? new ImageData(buffer, w, h)
        : ({ width: w, height: h, data: buffer, colorSpace: 'srgb' } as ImageData);
      const dst = plateImg.data;
      let nonZeroCount = 0;

      for (let i = 0; i < src.length; i += 4) {
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const a = src[i + 3];

        if (a < 20) {
          dst[i + 3] = 0;
          continue;
        }

        // Density mapping based on plate channel
        let density = 0;
        if (p === 0) { // Black / darks
          density = 255 - (0.299 * r + 0.587 * g + 0.114 * b);
        } else if (p === 1) { // Warm / Pinks (R > G)
          density = Math.max(0, r - g);
        } else if (p === 2) { // Cool / Blues (B > R)
          density = Math.max(0, b - r);
        } else {
          density = Math.max(0, g - b);
        }

        if (density > 20) {
          nonZeroCount++;
          // Exposure positive: pure black ink density on transparent/white film
          dst[i] = 0;
          dst[i + 1] = 0;
          dst[i + 2] = 0;
          dst[i + 3] = Math.min(255, density);
        } else {
          dst[i + 3] = 0;
        }
      }

      plates.push({
        plateIndex: p + 1,
        inkName: defaultInks[p].name,
        hexColor: defaultInks[p].hex,
        plateImageData: plateImg,
        coveragePercent: Number(((nonZeroCount / totalPixels) * 100).toFixed(1))
      });
    }

    return plates;
  }
}
