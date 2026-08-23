/**
 * 💎 CrystalUV-Heightmap-Builder DTF-UV Crystal Transfer Sticker 3D Heightmap Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * Creating DTF-UV crystal transfer stickers (水晶標) and 3D tactile textured phone cases requires
 * multiple layered print passes: glue adhesive base + white ink foundation + CMYK graphic + 3~5 stacked UV gloss varnish passes.
 * 
 * Solution:
 * Generates an automated 5-tier grayscale heightmap and underbase white mask ready for UV flatbed printers.
 */

export interface CrystalUvLayers {
  whiteUnderbaseMask: ImageData;
  varnishHeightmap: ImageData;
  varnishLevels: number;
  totalReliefDepthMm: number;
}

export class CrystalUvHeightmap {
  /**
   * Generates white underbase and multi-tiered UV gloss varnish heightmap layers
   */
  public static generateCrystalLayers(
    srcImageData: ImageData,
    varnishLevels: number = 4
  ): CrystalUvLayers {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const whiteBuffer = new Uint8ClampedArray(w * h * 4);
    const varnishBuffer = new Uint8ClampedArray(w * h * 4);

    const whiteMask: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(whiteBuffer, w, h)
      : ({ width: w, height: h, data: whiteBuffer, colorSpace: 'srgb' } as ImageData);
    const varnishMap: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(varnishBuffer, w, h)
      : ({ width: w, height: h, data: varnishBuffer, colorSpace: 'srgb' } as ImageData);

    const wData = whiteMask.data;
    const vData = varnishMap.data;

    for (let i = 0; i < src.length; i += 4) {
      const a = src[i + 3];
      const lum = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255;

      if (a > 30) {
        // 1. White underbase layer (100% K100 binary mask for white ink foundation)
        wData[i] = 0;
        wData[i + 1] = 0;
        wData[i + 2] = 0;
        wData[i + 3] = 255;

        // 2. Multi-tier UV gloss varnish heightmap (stepped grayscale elevation)
        // High highlights receive thicker relief gloss (255), flat midtones receive smooth gloss
        const step = Math.min(varnishLevels, Math.max(1, Math.ceil(lum * varnishLevels)));
        const heightVal = Math.round((step / varnishLevels) * 255);

        vData[i] = heightVal;
        vData[i + 1] = heightVal;
        vData[i + 2] = heightVal;
        vData[i + 3] = 255;
      } else {
        wData[i + 3] = 0;
        vData[i + 3] = 0;
      }
    }

    return {
      whiteUnderbaseMask: whiteMask,
      varnishHeightmap: varnishMap,
      varnishLevels,
      totalReliefDepthMm: Number((varnishLevels * 0.08).toFixed(2)) // ~0.32mm physical thickness
    };
  }
}
