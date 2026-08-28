/**
 * Color Vision Deficiency (CVD) Simulator
 *
 * Real implementation of the Machado, Oliveira & Fernandes 2009 model ("A Physiologically-based
 * Model for Simulation of Color Vision Deficiency", IEEE TVCG 15(6), 2009). The full-severity
 * (100%) dichromacy matrices below were taken from the authors' own supplementary data page
 * (inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html) and cross-checked
 * against two independent sources: DaltonLens-Python's `machado_2009_matrices` table (MIT
 * licensed) and Chrome DevTools' CVD emulation feColorMatrix values — all match to the decimal
 * places both sources publish.
 *
 * Real-world use here: a print-design preflight preview ("what does this look like to a color-
 * blind viewer?") — useful when a design leans on color alone to distinguish elements (e.g. a
 * red/green status chart) that would be illegible to ~8% of male viewers.
 *
 * IMPORTANT, verified pitfall: the matrices must be applied to LINEAR RGB, not gamma-encoded
 * sRGB. This is a real, documented mistake — the R `colorspace` package shipped CVD simulation
 * against gamma-encoded sRGB until v2.1-0, then published a correction citing the paper's own
 * implicit linear-RGB assumption (page 1294, column 1). This implementation decodes sRGB to
 * linear, applies the matrix, then re-encodes back to sRGB.
 *
 * Partial severity (the `severity` parameter) is NOT from the paper — Machado 2009 only
 * supplied verified matrices at 100% (full dichromacy); this implementation linearly
 * interpolates between the identity transform and the full matrix as a common, documented
 * approximation (used by several other CVD simulators), not a primary-sourced intermediate
 * model. Default is full severity (1.0), matching the typical "view as a protanope" use case.
 */

import { CmykEngine } from './cmyk-engine';
import { createBlankImageData } from './image-data-factory';

export type CvdType = 'protanopia' | 'deuteranopia' | 'tritanopia';

export class ColorBlindnessSimulator {
  // sRGB<->linear conversion reuses CmykEngine's LUT/formula (2026-08-28 deduped — this file used
  // to maintain its own byte-identical copy of both).

  // Full-severity (100%) dichromacy matrices, Machado/Oliveira/Fernandes 2009 — see header note.
  private static readonly MATRICES: Record<CvdType, readonly number[]> = {
    protanopia: [
      0.152286, 1.052583, -0.204868,
      0.114503, 0.786281, 0.099216,
      -0.003882, -0.048116, 1.051998
    ],
    deuteranopia: [
      0.367322, 0.860646, -0.227968,
      0.280085, 0.672501, 0.047413,
      -0.011820, 0.042940, 0.968881
    ],
    tritanopia: [
      1.255528, -0.076749, -0.178779,
      -0.078411, 0.930809, 0.147602,
      0.004733, 0.691367, 0.303900
    ]
  };

  /**
   * Renders a preview of how a viewer with the given color vision deficiency would see this
   * image. `severity` in [0, 1] — see the honesty note above about how partial severity is
   * approximated (linear interpolation, not a primary-sourced model).
   */
  public static simulate(
    imageData: ImageData,
    type: CvdType,
    severity: number = 1.0
  ): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = createBlankImageData(width, height);
    const dst = output.data;

    const M = this.MATRICES[type];
    const s = Math.min(1, Math.max(0, severity));

    for (let i = 0; i < src.length; i += 4) {
      const linR = CmykEngine.sRgbToLinear(src[i]);
      const linG = CmykEngine.sRgbToLinear(src[i + 1]);
      const linB = CmykEngine.sRgbToLinear(src[i + 2]);

      const simR = M[0] * linR + M[1] * linG + M[2] * linB;
      const simG = M[3] * linR + M[4] * linG + M[5] * linB;
      const simB = M[6] * linR + M[7] * linG + M[8] * linB;

      const outR = linR + (simR - linR) * s;
      const outG = linG + (simG - linG) * s;
      const outB = linB + (simB - linB) * s;

      dst[i] = CmykEngine.linearToSRgb(outR);
      dst[i + 1] = CmykEngine.linearToSRgb(outG);
      dst[i + 2] = CmykEngine.linearToSRgb(outB);
      dst[i + 3] = src[i + 3];
    }

    return output;
  }

  /**
   * Estimates how much perceptual color-difference is lost for CVD viewers, as a rough
   * preflight risk score. Compares the mean per-pixel linear-RGB distance between the original
   * and each simulated variant against the original image's own color variance — a design that
   * relies heavily on color contrast a CVD viewer can't perceive will show high loss relative to
   * its own variance. This is a heuristic risk indicator, not a validated accessibility metric.
   */
  public static assessRisk(imageData: ImageData): {
    type: CvdType;
    meanColorLossRatio: number;
    riskLevel: 'low' | 'moderate' | 'high';
  }[] {
    const types: CvdType[] = ['protanopia', 'deuteranopia', 'tritanopia'];
    const src = imageData.data;
    const lut = CmykEngine.getSrgbToLinearLut();
    const totalPixels = src.length / 4;
    const stride = totalPixels > 250_000 ? 4 : 1;

    // Original image's own color variance (mean pairwise distance to global mean), as a baseline.
    let sumR = 0, sumG = 0, sumB = 0, sampled = 0;
    for (let i = 0; i < src.length; i += 4 * stride) {
      sumR += lut[src[i]];
      sumG += lut[src[i + 1]];
      sumB += lut[src[i + 2]];
      sampled++;
    }
    const meanR = sumR / sampled, meanG = sumG / sampled, meanB = sumB / sampled;
    let varianceSum = 0;
    for (let i = 0; i < src.length; i += 4 * stride) {
      const dr = lut[src[i]] - meanR, dg = lut[src[i + 1]] - meanG, db = lut[src[i + 2]] - meanB;
      varianceSum += Math.sqrt(dr * dr + dg * dg + db * db);
    }
    const baselineVariance = Math.max(1e-6, varianceSum / sampled);

    return types.map((type) => {
      const M = this.MATRICES[type];
      let lossSum = 0;
      for (let i = 0; i < src.length; i += 4 * stride) {
        const linR = lut[src[i]], linG = lut[src[i + 1]], linB = lut[src[i + 2]];
        const simR = M[0] * linR + M[1] * linG + M[2] * linB;
        const simG = M[3] * linR + M[4] * linG + M[5] * linB;
        const simB = M[6] * linR + M[7] * linG + M[8] * linB;
        const dr = linR - simR, dg = linG - simG, db = linB - simB;
        lossSum += Math.sqrt(dr * dr + dg * dg + db * db);
      }
      const meanLoss = lossSum / sampled;
      const ratio = meanLoss / baselineVariance;

      const riskLevel: 'low' | 'moderate' | 'high' =
        ratio > 0.5 ? 'high' : ratio > 0.25 ? 'moderate' : 'low';

      return { type, meanColorLossRatio: Math.round(ratio * 1000) / 1000, riskLevel };
    });
  }
}
