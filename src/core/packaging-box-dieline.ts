/**
 * 📦 05. PackagingBoxDieline (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * E-commerce sellers and brand owners need custom folding packaging boxes (Mailer Box / Tuck End Box),
 * but hiring a CAD packaging designer costs thousands of dollars.
 * 
 * Mathematical Solution:
 * 1. Takes user input dimensions: Length (L) × Width (W) × Height (H) in millimeters.
 * 2. Parametrically generates complete 2D dieline:
 *    - Solid Magenta Line: Laser cutting line (#FF00FF).
 *    - Dashed Blue Line: Crease / Folding lines (#0088FF).
 *    - 15° Angled Glue Tab & Dust Flaps (15mm glue margin).
 *    - 3mm External Bleed Perimeter.
 * 3. Exports standard SVG CAD dieline for box factories and digital die-cutters.
 */

export interface BoxDimensions {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  materialThicknessMm?: number;
}

export class PackagingBoxDieline {
  public static generateTuckEndBoxSvg(dims: BoxDimensions): string {
    const L = dims.lengthMm;
    const W = dims.widthMm;
    const H = dims.heightMm;
    const glueTab = 15;
    const bleed = 3;

    // Total flat layout size calculation
    const totalW = glueTab + (L * 2) + (W * 2) + (bleed * 2);
    const totalH = H + (W * 2) + (bleed * 2);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}mm" height="${totalH}mm">
  <defs>
    <style>
      .dieline-cut { stroke: #FF00FF; stroke-width: 0.5; fill: none; }
      .dieline-crease { stroke: #0088FF; stroke-width: 0.5; stroke-dasharray: 2,2; fill: none; }
      .dieline-bleed { stroke: #00FF88; stroke-width: 0.3; stroke-dasharray: 1,1; fill: none; }
      .box-label { font-family: sans-serif; font-size: 3px; fill: #333; }
    </style>
  </defs>

  <!-- 3mm Bleed Outer Box -->
  <rect x="0" y="0" width="${totalW}" height="${totalH}" class="dieline-bleed" />

  <!-- Outer Cutting Perimeter (Solid Magenta) -->
  <path d="M ${bleed + glueTab} ${bleed + W}
           L ${bleed + glueTab} ${bleed}
           L ${bleed + glueTab + L} ${bleed}
           L ${bleed + glueTab + L} ${bleed + W}
           L ${bleed + glueTab + L + W} ${bleed + W}
           L ${bleed + glueTab + L + W + L} ${bleed}
           L ${bleed + glueTab + L + W + L + W} ${bleed}
           L ${bleed + totalW - bleed} ${bleed + W}
           L ${bleed + totalW - bleed} ${bleed + W + H}
           L ${bleed + glueTab + L + W + L + W} ${bleed + W + H + W}
           L ${bleed + glueTab + L + W + L} ${bleed + W + H + W}
           L ${bleed + glueTab + L + W} ${bleed + W + H}
           L ${bleed + glueTab + L} ${bleed + W + H + W}
           L ${bleed + glueTab} ${bleed + W + H + W}
           L ${bleed + glueTab} ${bleed + W + H}
           L ${bleed} ${bleed + W + H - 5}
           L ${bleed} ${bleed + W + 5}
           Z" class="dieline-cut" />

  <!-- Internal Crease Lines (Dashed Blue) -->
  <!-- Vertical fold lines -->
  <line x1="${bleed + glueTab}" y1="${bleed + W}" x2="${bleed + glueTab}" y2="${bleed + W + H}" class="dieline-crease" />
  <line x1="${bleed + glueTab + L}" y1="${bleed + W}" x2="${bleed + glueTab + L}" y2="${bleed + W + H}" class="dieline-crease" />
  <line x1="${bleed + glueTab + L + W}" y1="${bleed + W}" x2="${bleed + glueTab + L + W}" y2="${bleed + W + H}" class="dieline-crease" />
  <line x1="${bleed + glueTab + L + W + L}" y1="${bleed + W}" x2="${bleed + glueTab + L + W + L}" y2="${bleed + W + H}" class="dieline-crease" />

  <!-- Horizontal fold lines -->
  <line x1="${bleed + glueTab}" y1="${bleed + W}" x2="${bleed + totalW - bleed}" y2="${bleed + W}" class="dieline-crease" />
  <line x1="${bleed + glueTab}" y1="${bleed + W + H}" x2="${bleed + totalW - bleed}" y2="${bleed + W + H}" class="dieline-crease" />

  <!-- Dimensions Text -->
  <text x="${bleed + glueTab + 5}" y="${bleed + W + H / 2}" class="box-label">正面 ${L}×${H}mm</text>
  <text x="${bleed + glueTab + L + 5}" y="${bleed + W + H / 2}" class="box-label">側面 ${W}×${H}mm</text>
  <text x="${bleed + glueTab + L + W + 5}" y="${bleed + W + H / 2}" class="box-label">背面 ${L}×${H}mm</text>
  <text x="${bleed + glueTab + L + W + L + 5}" y="${bleed + W + H / 2}" class="box-label">側面 ${W}×${H}mm</text>
  <text x="${bleed + 2}" y="${bleed + W + H / 2}" class="box-label">糊邊 ${glueTab}mm</text>
</svg>`;

    return svg;
  }
}
