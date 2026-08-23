import { K100BarcodeGenerator } from '../../src/core/k100-barcode-generator.js';
import { SvgPathOptimizer } from '../../src/core/svg-path-optimizer.js';
import { ImpositionCalculator, type SheetSpec } from '../../src/core/imposition-calculator.js';
import { PantoneMatcher } from '../../src/core/pantone-matcher.js';

/**
 * 🛠️ Industrial Pre-Press Extended Toolkit Service (Backend Core)
 * 
 * Provides:
 * 1. K100 Vector Barcode & QR Generator
 * 2. SVG Dieline & Cut Path Optimizer
 * 3. A4/A3 Gang-Run Imposition Layout Calculator
 * 4. Pantone CIELAB Spot Color Matcher
 */
export class PrepressToolkitService {
  /**
   * Generates pure K100 Barcode or QR Code SVG
   */
  public static generateBarcode(text: string, type: 'qr' | 'code128' = 'qr'): string {
    if (type === 'qr') {
      return K100BarcodeGenerator.generateQrCodeSvg(text, 6, 4);
    }
    return K100BarcodeGenerator.generateCode128Svg(text, 80, 2);
  }

  /**
   * Minifies & optimizes SVG path coordinates for laser cutting plotters
   */
  public static optimizeSvg(svgString: string, precision: number = 1) {
    return SvgPathOptimizer.optimize(svgString, precision);
  }

  /**
   * Calculates gang-run imposition layout
   */
  public static calculateImposition(
    itemWidthMm: number,
    itemHeightMm: number,
    sheetId: SheetSpec['id'] = 'A3',
    cuttingGapMm: number = 3
  ) {
    return ImpositionCalculator.calculate(itemWidthMm, itemHeightMm, sheetId, cuttingGapMm);
  }

  /**
   * Matches an RGB hex/color to closest Pantone Solid Coated / Metallic spot color
   */
  public static matchPantone(r: number, g: number, b: number) {
    return PantoneMatcher.matchRgb(r, g, b);
  }
}

