/**
 * 🌈 Pantone Spot Color Matcher & CIELAB ΔE2000 Engine
 * 
 * Pre-Press Problem Solved:
 * Luxury packaging, stationery, foil-stamping, and corporate brand guidelines require
 * exact Pantone Solid Coated / Uncoated spot color codes (e.g. Pantone 185 C, Pantone 871 C Gold),
 * rather than arbitrary RGB/CMYK mixtures.
 * 
 * Solution:
 * 1. Converts pixel RGB to standard CIE XYZ and CIELAB color space.
 * 2. Samples dominant artwork palette via spatial color quantization.
 * 3. Matches colors against ISO standard Pantone Solid Coated & Metallic database using CIE ΔE2000.
 * 4. Outputs exact Pantone Code, HEX, CMYK ink-mix percentage, and Delta E accuracy.
 */

export interface PantoneColor {
  code: string;
  name: string;
  category: 'coated' | 'metallic' | 'pastel' | 'neon';
  hex: string;
  lab: [number, number, number]; // L*, a*, b*
  cmyk: [number, number, number, number]; // C, M, Y, K percentage
}

export interface SpotColorMatchResult {
  pantone: PantoneColor;
  deltaE: number; // < 1.0 = imperceptible, < 2.5 = commercial match, > 5.0 = perceptible
  originalHex: string;
  accuracy: 'exact' | 'close' | 'approximate';
}

export class PantoneMatcher {
  // Curated ISO Standard Pantone Solid Coated, Metallic & Brand Spot Color Palette
  private static readonly PANTONE_DATABASE: PantoneColor[] = [
    // Standards & Primaries
    { code: 'Pantone 185 C', name: 'Classic Red', category: 'coated', hex: '#E4002B', lab: [48.2, 73.1, 46.5], cmyk: [0, 93, 79, 0] },
    { code: 'Pantone 485 C', name: 'Bright Red', category: 'coated', hex: '#DA291C', lab: [47.5, 68.3, 52.8], cmyk: [0, 95, 100, 0] },
    { code: 'Pantone 021 C', name: 'Safety Orange', category: 'coated', hex: '#FE5000', lab: [59.6, 61.4, 75.3], cmyk: [0, 68, 100, 0] },
    { code: 'Pantone 109 C', name: 'Process Yellow', category: 'coated', hex: '#FFD100', lab: [85.7, -4.2, 88.5], cmyk: [0, 10, 100, 0] },
    { code: 'Pantone 354 C', name: 'Spring Green', category: 'coated', hex: '#00B140', lab: [61.8, -63.5, 42.1], cmyk: [80, 0, 90, 0] },
    { code: 'Pantone 300 C', name: 'Process Blue', category: 'coated', hex: '#005EB8', lab: [40.2, 5.4, -58.2], cmyk: [99, 50, 0, 0] },
    { code: 'Pantone Reflex Blue C', name: 'Reflex Blue', category: 'coated', hex: '#0A1172', lab: [16.8, 38.1, -73.4], cmyk: [100, 89, 0, 0] },
    { code: 'Pantone 2685 C', name: 'Imperial Violet', category: 'coated', hex: '#330072', lab: [19.2, 49.3, -54.1], cmyk: [90, 100, 0, 10] },
    { code: 'Pantone 219 C', name: 'Barbie Magenta', category: 'coated', hex: '#DA1884', lab: [49.2, 75.6, -11.2], cmyk: [0, 92, 0, 0] },
    { code: 'Pantone Black C', name: 'Rich Black', category: 'coated', hex: '#2D2926', lab: [18.2, 1.2, 2.1], cmyk: [0, 0, 0, 100] },
    { code: 'Pantone Cool Gray 7 C', name: 'Neutral Gray', category: 'coated', hex: '#97999B', lab: [63.2, -0.4, -0.8], cmyk: [0, 0, 0, 45] },
    
    // Metallics (Foil & Metallic Inks)
    { code: 'Pantone 871 C', name: 'Rich Pale Gold', category: 'metallic', hex: '#84754E', lab: [50.1, 2.8, 24.5], cmyk: [20, 25, 60, 25] },
    { code: 'Pantone 872 C', name: 'Rich Gold', category: 'metallic', hex: '#85714D', lab: [48.7, 4.3, 25.1], cmyk: [20, 30, 65, 30] },
    { code: 'Pantone 877 C', name: 'Classic Silver', category: 'metallic', hex: '#8A8D8F', lab: [58.4, -0.6, -1.2], cmyk: [0, 0, 0, 40] },
    { code: 'Pantone 876 C', name: 'Copper Foil', category: 'metallic', hex: '#8B5B43', lab: [43.1, 19.2, 23.4], cmyk: [15, 50, 65, 25] },
    { code: 'Pantone 10128 C', name: 'Rose Gold Metallic', category: 'metallic', hex: '#B76E79', lab: [52.8, 30.1, 10.2], cmyk: [10, 55, 35, 10] },
    
    // Neons & Fluorescents
    { code: 'Pantone 805 C', name: 'Fluorescent Red/Orange', category: 'neon', hex: '#FF4858', lab: [58.2, 71.3, 35.1], cmyk: [0, 78, 55, 0] },
    { code: 'Pantone 806 C', name: 'Fluorescent Pink', category: 'neon', hex: '#FF3EB5', lab: [56.4, 82.1, -18.2], cmyk: [0, 80, 0, 0] },
    { code: 'Pantone 802 C', name: 'Fluorescent Green', category: 'neon', hex: '#44D62C', lab: [75.1, -68.2, 65.4], cmyk: [55, 0, 95, 0] }
  ];

  /**
   * Matches a single RGB color to the closest Pantone Spot Color
   */
  public static matchRgb(r: number, g: number, b: number): SpotColorMatchResult {
    const lab = this.rgbToLab(r, g, b);
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

    let minDeltaE = Infinity;
    let bestMatch = this.PANTONE_DATABASE[0];

    for (const pantone of this.PANTONE_DATABASE) {
      const dE = this.calculateDeltaE2000(lab, pantone.lab);
      if (dE < minDeltaE) {
        minDeltaE = dE;
        bestMatch = pantone;
      }
    }

    const roundedDE = Math.round(minDeltaE * 10) / 10;
    const accuracy = roundedDE <= 2.5 ? 'exact' : roundedDE <= 6.0 ? 'close' : 'approximate';

    return {
      pantone: bestMatch,
      deltaE: roundedDE,
      originalHex: hex,
      accuracy
    };
  }

  /**
   * Extracts top dominant spot colors from canvas image data
   */
  public static extractDominantSpotColors(imageData: ImageData, maxCount: number = 5): SpotColorMatchResult[] {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const step = Math.max(1, Math.floor(Math.max(w, h) / 120));

    const colorCounts = new Map<string, { r: number; g: number; b: number; count: number }>();

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        const a = data[idx + 3];
        if (a < 80) continue; // skip alpha transparent

        // Quantize to 16-step buckets
        const qr = Math.min(255, Math.round(data[idx] / 24) * 24);
        const qg = Math.min(255, Math.round(data[idx + 1] / 24) * 24);
        const qb = Math.min(255, Math.round(data[idx + 2] / 24) * 24);
        const key = `${qr},${qg},${qb}`;

        if (!colorCounts.has(key)) {
          colorCounts.set(key, { r: qr, g: qg, b: qb, count: 0 });
        }
        colorCounts.get(key)!.count++;
      }
    }

    const sorted = Array.from(colorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, maxCount * 2);

    const matches: SpotColorMatchResult[] = [];
    const seenCodes = new Set<string>();

    for (const entry of sorted) {
      const match = this.matchRgb(entry.r, entry.g, entry.b);
      if (!seenCodes.has(match.pantone.code)) {
        seenCodes.add(match.pantone.code);
        matches.push(match);
        if (matches.length >= maxCount) break;
      }
    }

    return matches;
  }

  // ─── Color Space Conversion Math (sRGB ➔ CIE XYZ ➔ CIE Lab) ─────────────
  public static rgbToLab(r: number, g: number, b: number): [number, number, number] {
    let rL = r / 255;
    let gL = g / 255;
    let bL = b / 255;

    rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
    gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
    bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;

    // D65 Standard Illuminant
    const x = (rL * 0.4124564 + gL * 0.3575761 + bL * 0.1804375) / 0.95047;
    const y = (rL * 0.2126729 + gL * 0.7151522 + bL * 0.0721750) / 1.00000;
    const z = (rL * 0.0193339 + gL * 0.1191920 + bL * 0.9503041) / 1.08883;

    const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
    const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
    const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const bLab = 200 * (fy - fz);

    return [Math.round(L * 10) / 10, Math.round(a * 10) / 10, Math.round(bLab * 10) / 10];
  }

  /**
   * Precise CIE ΔE 2000 (dE2000) Perceptual Color Difference Formula
   */
  public static calculateDeltaE2000(lab1: [number, number, number], lab2: [number, number, number]): number {
    const [L1, a1, b1] = lab1;
    const [L2, a2, b2] = lab2;

    const kL = 1, kC = 1, kH = 1;
    const C1 = Math.hypot(a1, b1);
    const C2 = Math.hypot(a2, b2);
    const meanC = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(Math.pow(meanC, 7) / (Math.pow(meanC, 7) + Math.pow(25, 7))));
    const a1Prime = (1 + G) * a1;
    const a2Prime = (1 + G) * a2;

    const C1Prime = Math.hypot(a1Prime, b1);
    const C2Prime = Math.hypot(a2Prime, b2);

    const h1Prime = Math.atan2(b1, a1Prime) >= 0 ? Math.atan2(b1, a1Prime) : Math.atan2(b1, a1Prime) + 2 * Math.PI;
    const h2Prime = Math.atan2(b2, a2Prime) >= 0 ? Math.atan2(b2, a2Prime) : Math.atan2(b2, a2Prime) + 2 * Math.PI;

    const deltaLPrime = L2 - L1;
    const deltaCPrime = C2Prime - C1Prime;

    let deltahPrime = 0;
    if (C1Prime * C2Prime !== 0) {
      if (Math.abs(h2Prime - h1Prime) <= Math.PI) deltahPrime = h2Prime - h1Prime;
      else if (h2Prime - h1Prime > Math.PI) deltahPrime = (h2Prime - h1Prime) - 2 * Math.PI;
      else deltahPrime = (h2Prime - h1Prime) + 2 * Math.PI;
    }

    const deltaHPrime = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(deltahPrime / 2);

    const meanLPrime = (L1 + L2) / 2;
    const meanCPrime = (C1Prime + C2Prime) / 2;

    let meanhPrime = (h1Prime + h2Prime) / 2;
    if (Math.abs(h1Prime - h2Prime) > Math.PI) {
      meanhPrime += meanhPrime < Math.PI ? Math.PI : -Math.PI;
    }

    const T = 1 - 0.17 * Math.cos(meanhPrime - Math.PI / 6)
      + 0.24 * Math.cos(2 * meanhPrime)
      + 0.32 * Math.cos(3 * meanhPrime + Math.PI / 30)
      - 0.20 * Math.cos(4 * meanhPrime - Math.PI * 7 / 20);

    const sL = 1 + (0.015 * Math.pow(meanLPrime - 50, 2)) / Math.sqrt(20 + Math.pow(meanLPrime - 50, 2));
    const sC = 1 + 0.045 * meanCPrime;
    const sH = 1 + 0.015 * meanCPrime * T;

    const deltaTheta = (Math.PI / 6) * Math.exp(-Math.pow((meanhPrime - Math.PI * 11 / 12) / (Math.PI * 25 / 180), 2));
    const R_C = 2 * Math.sqrt(Math.pow(meanCPrime, 7) / (Math.pow(meanCPrime, 7) + Math.pow(25, 7)));
    const R_T = -Math.sin(2 * deltaTheta) * R_C;

    const dE = Math.sqrt(
      Math.pow(deltaLPrime / (kL * sL), 2) +
      Math.pow(deltaCPrime / (kC * sC), 2) +
      Math.pow(deltaHPrime / (kH * sH), 2) +
      R_T * (deltaCPrime / (kC * sC)) * (deltaHPrime / (kH * sH))
    );

    return isNaN(dE) ? 0 : dE;
  }
}
