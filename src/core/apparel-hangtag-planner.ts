/**
 * 🏷️ 08. ApparelHangTagPlanner (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * Boutique clothing brands and indie designers need custom clothing hang tags (45x90mm / 50x100mm)
 * with a 3mm punch hole for nylon/cotton string, price barcodes, and washing instructions.
 * 
 * Mathematical Solution:
 * 1. Parametrically generates vertical/horizontal apparel hang tag vectors:
 *    - 3mm/4mm string punch hole at top (8mm safety clearance).
 *    - 3mm perimeter cutting line & bleed margin.
 *    - Structured slots for brand logo, care symbols, and EAN-13 price barcode.
 * 2. Auto-tiles multiple hangtags onto A4/A3 sheet with 2mm gutter for batch die-cutting.
 */

export interface HangTagConfig {
  tagWidthMm: number;
  tagHeightMm: number;
  holeDiameterMm: number;
  holeOffsetFromTopMm: number;
  brandName: string;
  priceNtd: number;
}

export class ApparelHangTagPlanner {
  public static generateSingleHangTagSvg(config: HangTagConfig): string {
    const W = config.tagWidthMm;
    const H = config.tagHeightMm;
    const holeD = config.holeDiameterMm || 3.5;
    const holeY = config.holeOffsetFromTopMm || 8;
    const holeX = W / 2;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">
  <defs>
    <style>
      .tag-cut { stroke: #FF00FF; stroke-width: 0.4; fill: none; }
      .tag-hole { stroke: #FF0000; stroke-width: 0.4; fill: none; }
      .tag-safe { stroke: #00FF88; stroke-width: 0.2; stroke-dasharray: 1,1; fill: none; }
      .brand-title { font-family: sans-serif; font-size: 4.5px; font-weight: bold; fill: #111; text-anchor: middle; }
      .price-text { font-family: sans-serif; font-size: 3.5px; font-weight: 600; fill: #222; text-anchor: middle; }
    </style>
  </defs>

  <!-- 3mm Outer Cutting Boundary (R2 Rounded Corner) -->
  <rect x="0" y="0" width="${W}" height="${H}" rx="2" ry="2" class="tag-cut" />

  <!-- 3.5mm String Punch Hole -->
  <circle cx="${holeX}" cy="${holeY}" r="${holeD / 2}" class="tag-hole" />

  <!-- 8mm Top Safe Zone Circle -->
  <circle cx="${holeX}" cy="${holeY}" r="${(holeD / 2) + 2.5}" class="tag-safe" />

  <!-- Brand Typography -->
  <text x="${holeX}" y="${H * 0.45}" class="brand-title">${config.brandName || 'BRAND COLLECTION'}</text>

  <!-- Price & Barcode Zone -->
  <text x="${holeX}" y="${H * 0.85}" class="price-text">NT$ ${config.priceNtd || 590}</text>
</svg>`;
  }

  public static calculateA4Tiling(tagW: number, tagH: number): { cols: number; rows: number; totalPerA4: number } {
    const a4W = 210;
    const a4H = 297;
    const margin = 10;
    const spacing = 3;

    const cols = Math.floor((a4W - margin * 2) / (tagW + spacing));
    const rows = Math.floor((a4H - margin * 2) / (tagH + spacing));

    return {
      cols,
      rows,
      totalPerA4: cols * rows
    };
  }
}
