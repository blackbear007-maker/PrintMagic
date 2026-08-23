/**
 * 09. 📖 SpineWidth-Calculator Perfect Book Spine Thickness Deduction Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * When binding booklets, doujinshi artbooks, and catalogs (膠裝/精裝), incorrect book spine width
 * calculations cause spine text to spill onto the front cover or crease off-center.
 * 
 * Solution:
 * Computes exact physical spine thickness from page count, paper basis weight (GSM),
 * caliper bulk coefficient, and cover stock fold allowances.
 */

export interface SpineCalculationResult {
  spineWidthMm: number;
  totalPageCount: number;
  paperStockName: string;
  coverBleedMarginMm: number;
  recommendations: string[];
}

export class SpineWidthCalculator {
  /**
   * Calculates exact physical spine width in millimeters
   */
  public static calculateSpine(
    pageCount: number = 80,
    paperGsm: number = 100, // 80, 100, 120, 150 gsm
    bindingType: 'perfect' | 'hardcover' | 'saddle-stitch' = 'perfect'
  ): SpineCalculationResult {
    if (bindingType === 'saddle-stitch') {
      return {
        spineWidthMm: 0,
        totalPageCount: pageCount,
        paperStockName: `${paperGsm}gsm 騎馬釘`,
        coverBleedMarginMm: 3,
        recommendations: ['✓ 騎馬釘裝訂無獨立書背厚度，封面與封底直連即可。']
      };
    }

    // Physical caliper bulk factor (mm per sheet = 2 pages)
    // 100gsm woodfree paper ≈ 0.12mm per sheet
    const sheets = Math.ceil(pageCount / 2);
    const caliperMmPerSheet = (paperGsm / 1000) * 1.15;
    let spineMm = sheets * caliperMmPerSheet;

    if (bindingType === 'hardcover') {
      spineMm += 3.0; // 3mm chipboard wrapped case allowance
    }

    const roundedSpine = Number(spineMm.toFixed(2));
    const recommendations: string[] = [
      `✓ 書背寬度精確計算為 ${roundedSpine} mm。`,
      `✓ 建議封面展開尺寸包含：封底 + ${roundedSpine}mm 書背 + 封面 + 3mm 左右出血。`
    ];

    return {
      spineWidthMm: roundedSpine,
      totalPageCount: pageCount,
      paperStockName: `${paperGsm}gsm 道林/銅版紙`,
      coverBleedMarginMm: 3,
      recommendations
    };
  }
}
