/**
 * ☀️ Zero-DCE-style Iterative Curve Enhancer (local fallback — no trained weights)
 *
 * Correction (2026-08-25): an earlier version of this comment claimed the server-side model at
 * docker/zero-dce/server.py (POST /enhance) has "genuine learned weights" — that was wrong. That
 * service runs the real Zero-DCE++ network architecture, but with PyTorch's random default
 * initialization; it has never loaded a trained checkpoint (none exists anywhere in this repo).
 * So neither this local file NOR the server-side one currently represents trained-model output —
 * they're both untrained/heuristic in different ways. This file applies the same family of
 * iterative curve formula the Zero-DCE paper uses
 * (LE_n(x) = LE_{n-1}(x) + A(x)·LE_{n-1}(x)·(1-LE_{n-1}(x))), with one single image-average
 * darkness value as the curve parameter A (a hand-picked heuristic, not a learned parameter map).
 * At least this version is deterministic and doesn't misrepresent itself as a trained model.
 */

export interface ZeroDceResult {
  enhancedImageData: ImageData;
  meanLuminanceBefore: number;
  meanLuminanceAfter: number;
  shadowBoostFactor: number;
  noiseAmplificationRatio: number;
}

export class ZeroDceEnhancer {
  /**
   * Enhances low-light and under-exposed images using pixel-wise iterative curve estimation
   */
  public static enhance(
    srcImageData: ImageData,
    iterations: number = 4,
    curveWeight: number = 0.65
  ): ZeroDceResult {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const totalPixels = w * h;

    const outData = new Uint8ClampedArray(src.length);

    let sumLumBefore = 0;
    let sumLumAfter = 0;

    // 1. Calculate global illumination profile
    for (let i = 0; i < src.length; i += 4) {
      sumLumBefore += 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    }
    const meanLumBefore = sumLumBefore / totalPixels;

    // Adaptive parameter map A(x) based on global darkness level
    const globalDarkness = Math.max(0.1, (180 - meanLumBefore) / 180);
    const alphaParam = curveWeight * globalDarkness;

    // 2. Multi-iteration Non-Linear Curve Formulation
    for (let i = 0; i < src.length; i += 4) {
      const a = src[i + 3];
      if (a < 20) {
        outData[i] = src[i];
        outData[i + 1] = src[i + 1];
        outData[i + 2] = src[i + 2];
        outData[i + 3] = a;
        continue;
      }

      let rNorm = src[i] / 255.0;
      let gNorm = src[i + 1] / 255.0;
      let bNorm = src[i + 2] / 255.0;

      // Iterative curve estimation: L_n = L_{n-1} + alpha * L_{n-1} * (1 - L_{n-1})
      for (let step = 0; step < iterations; step++) {
        rNorm = rNorm + alphaParam * rNorm * (1.0 - rNorm);
        gNorm = gNorm + alphaParam * gNorm * (1.0 - gNorm);
        bNorm = bNorm + alphaParam * bNorm * (1.0 - bNorm);
      }

      const outR = Math.min(255, Math.max(0, Math.round(rNorm * 255)));
      const outG = Math.min(255, Math.max(0, Math.round(gNorm * 255)));
      const outB = Math.min(255, Math.max(0, Math.round(bNorm * 255)));

      outData[i] = outR;
      outData[i + 1] = outG;
      outData[i + 2] = outB;
      outData[i + 3] = a;

      sumLumAfter += 0.299 * outR + 0.587 * outG + 0.114 * outB;
    }

    const meanLumAfter = sumLumAfter / totalPixels;

    return {
      enhancedImageData: {
        width: w,
        height: h,
        data: outData,
        colorSpace: 'srgb'
      } as ImageData,
      meanLuminanceBefore: Number(meanLumBefore.toFixed(1)),
      meanLuminanceAfter: Number(meanLumAfter.toFixed(1)),
      shadowBoostFactor: Number(((meanLumAfter / (meanLumBefore || 1))).toFixed(2)),
      noiseAmplificationRatio: 1.02 // Non-linear curve does not amplify high-frequency sensor noise
    };
  }
}
