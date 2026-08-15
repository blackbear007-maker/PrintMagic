/**
 * CMYK Color Science Engine
 * Simulates commercial print press gamut, sRGB linearization, and Gray Component Replacement (GCR)
 */
export class CmykEngine {
  /**
   * Convert sRGB gamma-compressed channel [0, 255] to linear RGB [0, 1]
   */
  public static sRgbToLinear(c: number): number {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  /**
   * Convert linear RGB [0, 1] to sRGB gamma-compressed [0, 255]
   */
  public static linearToSRgb(v: number): number {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(c * 255)));
  }

  /**
   * RGB to CMYK with customizable Gray Component Replacement (GCR)
   */
  public static rgbToCmyk(
    r: number,
    g: number,
    b: number,
    gcrFactor: number = 0.8
  ): { c: number; m: number; y: number; k: number } {
    const linR = this.sRgbToLinear(r);
    const linG = this.sRgbToLinear(g);
    const linB = this.sRgbToLinear(b);

    const kBase = 1 - Math.max(linR, linG, linB);
    let c = 0;
    let m = 0;
    let y = 0;
    let k = kBase;

    if (kBase < 1) {
      c = (1 - linR - kBase) / (1 - kBase);
      m = (1 - linG - kBase) / (1 - kBase);
      y = (1 - linB - kBase) / (1 - kBase);
    }

    // Apply Gray Component Replacement (GCR)
    const gray = Math.min(c, m, y);
    if (gray > 0 && gcrFactor > 0) {
      const gcrAmount = gray * gcrFactor;
      c -= gcrAmount;
      m -= gcrAmount;
      y -= gcrAmount;
      k = Math.min(1, k + gcrAmount * 0.5);
    }

    return {
      c: Math.min(1, Math.max(0, c)),
      m: Math.min(1, Math.max(0, m)),
      y: Math.min(1, Math.max(0, y)),
      k: Math.min(1, Math.max(0, k))
    };
  }

  /**
   * CMYK back to simulated RGB display
   */
  public static cmykToRgb(
    c: number,
    m: number,
    y: number,
    k: number
  ): { r: number; g: number; b: number } {
    const linR = (1 - c) * (1 - k);
    const linG = (1 - m) * (1 - k);
    const linB = (1 - y) * (1 - k);

    return {
      r: this.linearToSRgb(linR),
      g: this.linearToSRgb(linG),
      b: this.linearToSRgb(linB)
    };
  }

  /**
   * Detect Out-of-Gamut (OOG) pixels that cannot be printed accurately in CMYK
   * (e.g. ultra-bright neon cyans, greens, magentas)
   */
  public static analyzeGamut(imageData: ImageData): {
    outOfGamutCount: number;
    outOfGamutRatio: number;
    severity: 'low' | 'moderate' | 'high';
  } {
    const data = imageData.data;
    const totalPixels = data.length / 4;
    let oogCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const cmyk = this.rgbToCmyk(r, g, b);
      const simulatedRgb = this.cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);

      // Delta difference in RGB space
      const diff =
        Math.abs(r - simulatedRgb.r) +
        Math.abs(g - simulatedRgb.g) +
        Math.abs(b - simulatedRgb.b);

      if (diff > 45) {
        oogCount++;
      }
    }

    const ratio = totalPixels > 0 ? oogCount / totalPixels : 0;
    let severity: 'low' | 'moderate' | 'high' = 'low';
    if (ratio > 0.15) severity = 'high';
    else if (ratio > 0.05) severity = 'moderate';

    return {
      outOfGamutCount: oogCount,
      outOfGamutRatio: ratio,
      severity
    };
  }

  /**
   * Generate a Soft-Proofed preview representing realistic physical print colors
   */
  public static simulatePrintProof(imageData: ImageData): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    const src = imageData.data;
    const dst = output.data;

    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const a = src[i + 3];

      const cmyk = this.rgbToCmyk(r, g, b, 0.85);
      const proof = this.cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);

      dst[i] = proof.r;
      dst[i + 1] = proof.g;
      dst[i + 2] = proof.b;
      dst[i + 3] = a;
    }

    return output;
  }
}
