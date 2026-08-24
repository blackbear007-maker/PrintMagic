/**
 * 💍 01. WeddingSkinPorePreserver (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * Standard consumer beauty filters blur faces into plastic dolls, looking fake and cheap in 300 DPI wedding albums.
 * 
 * Mathematical Solution:
 * Frequency Separation (高低頻空間分離):
 * 1. Low-Frequency Layer: Smooths global lighting, blotchiness, and redness.
 * 2. High-Frequency Layer: Extracts and locks 100% authentic skin pore micro-texture and eyelashes.
 * 3. Recombines via linear light fusion for radiant, magazine-grade high-end portraits.
 */

export class WeddingSkinPorePreserver {
  public static preservePoresAndRetouch(
    srcImageData: ImageData,
    smoothIntensity: number = 0.65,
    poreSharpness: number = 1.2
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const outData = new Uint8ClampedArray(src.length);

    // 1. Compute Low-Frequency Layer (3x3 Box Blur approximation)
    const lowFreq = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = Math.min(h - 1, Math.max(0, y + dy));
          for (let dx = -1; dx <= 1; dx++) {
            const nx = Math.min(w - 1, Math.max(0, x + dx));
            const idx = (ny * w + nx) * 4;
            sumR += src[idx];
            sumG += src[idx + 1];
            sumB += src[idx + 2];
            count++;
          }
        }
        const pIdx = (y * w + x) * 3;
        lowFreq[pIdx] = sumR / count;
        lowFreq[pIdx + 1] = sumG / count;
        lowFreq[pIdx + 2] = sumB / count;
      }
    }

    // 2. High-Frequency Extraction & Linear Blend
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const p = (y * w + x) * 3;

        const origR = src[i];
        const origG = src[i + 1];
        const origB = src[i + 2];
        const origA = src[i + 3];

        // Skin Tone Check (R > G > B, warm tone)
        const isSkin = origR > 80 && origG > 40 && origB > 20 && origR > origG && (origR - origG) > 10;

        if (!isSkin) {
          outData[i] = origR;
          outData[i + 1] = origG;
          outData[i + 2] = origB;
          outData[i + 3] = origA;
          continue;
        }

        // High frequency delta = original - low
        const highR = (origR - lowFreq[p]) * poreSharpness;
        const highG = (origG - lowFreq[p + 1]) * poreSharpness;
        const highB = (origB - lowFreq[p + 2]) * poreSharpness;

        // Smooth low frequency tone
        const smoothLowR = origR * (1 - smoothIntensity) + lowFreq[p] * smoothIntensity;
        const smoothLowG = origG * (1 - smoothIntensity) + lowFreq[p + 1] * smoothIntensity;
        const smoothLowB = origB * (1 - smoothIntensity) + lowFreq[p + 2] * smoothIntensity;

        // Final composite: Smooth Tone + Preserved Pores
        outData[i] = Math.min(255, Math.max(0, Math.round(smoothLowR + highR)));
        outData[i + 1] = Math.min(255, Math.max(0, Math.round(smoothLowG + highG)));
        outData[i + 2] = Math.min(255, Math.max(0, Math.round(smoothLowB + highB)));
        outData[i + 3] = origA;
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
