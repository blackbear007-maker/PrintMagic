/**
 * 📐 Gang-Run Printing & Imposition Calculator (合版/拼版試算引擎)
 * 
 * Pre-Press Problem Solved:
 * Small businesses and indie creators print items (stickers, business cards, postcards) individually,
 * incurring huge single-run setup fees ($300~$800/run).
 * 
 * Solution:
 * Computes optimal 2D Bin Packing onto standard parent sheets (A4, A3,菊全開/對開 G1K/G2K),
 * calculating items-per-sheet, paper utilization rate, cutting gap margins, and total cost savings.
 */

export interface SheetSpec {
  id: 'A4' | 'A3' | 'A3_PLUS' | 'G2K_HALF' | 'G1K_FULL';
  name: string;
  widthMm: number;
  heightMm: number;
  costPerSheetTwd: number;
}

export const PARENT_SHEETS: SheetSpec[] = [
  { id: 'A4', name: 'A4 標準數位版', widthMm: 210, heightMm: 297, costPerSheetTwd: 12 },
  { id: 'A3', name: 'A3 商業數位版', widthMm: 297, heightMm: 420, costPerSheetTwd: 20 },
  { id: 'A3_PLUS', name: 'A3+ 滿版大圖 (Super A3)', widthMm: 329, heightMm: 483, costPerSheetTwd: 28 },
  { id: 'G2K_HALF', name: '菊二開 (傳統合版印刷)', widthMm: 420, heightMm: 594, costPerSheetTwd: 65 },
  { id: 'G1K_FULL', name: '菊全開 (巨幅工業版)', widthMm: 594, heightMm: 840, costPerSheetTwd: 120 }
];

export interface ImpositionResult {
  sheet: SheetSpec;
  itemsPerSheet: number;
  cols: number;
  rows: number;
  orientation: 'horizontal' | 'vertical';
  paperUtilizationPercent: number;
  cuttingGapMm: number;
  marginMm: number;
  estimatedSavingPercent: number;
  totalSheetsFor1000Items: number;
}

export class ImpositionCalculator {
  /**
   * Computes best gang-run imposition layout for a given item dimension
   */
  public static calculate(
    itemWidthMm: number,
    itemHeightMm: number,
    sheetId: SheetSpec['id'] = 'A3',
    cuttingGapMm: number = 3,
    marginMm: number = 5
  ): ImpositionResult {
    const sheet = PARENT_SHEETS.find((s) => s.id === sheetId) || PARENT_SHEETS[1];

    const printableW = sheet.widthMm - marginMm * 2;
    const printableH = sheet.heightMm - marginMm * 2;

    const itemSlotW = itemWidthMm + cuttingGapMm;
    const itemSlotH = itemHeightMm + cuttingGapMm;

    // Layout 1: Normal Orientation
    const cols1 = Math.floor(printableW / itemSlotW);
    const rows1 = Math.floor(printableH / itemSlotH);
    const count1 = cols1 * rows1;

    // Layout 2: Rotated 90 degrees
    const cols2 = Math.floor(printableW / itemSlotH);
    const rows2 = Math.floor(printableH / itemSlotW);
    const count2 = cols2 * rows2;

    const isRotatedBetter = count2 > count1;
    const bestCount = Math.max(1, isRotatedBetter ? count2 : count1);
    const bestCols = isRotatedBetter ? cols2 : cols1;
    const bestRows = isRotatedBetter ? rows2 : rows1;

    // Paper Utilization
    const itemArea = itemWidthMm * itemHeightMm * bestCount;
    const sheetArea = sheet.widthMm * sheet.heightMm;
    const utilization = Math.min(99, Math.round((itemArea / sheetArea) * 100));

    // Estimated Cost Savings (compared to single-sheet print runs)
    const savingPercent = bestCount > 1 ? Math.min(85, Math.round((1 - 1 / bestCount) * 100)) : 0;
    const totalSheetsNeeded = Math.ceil(1000 / bestCount);

    return {
      sheet,
      itemsPerSheet: bestCount,
      cols: bestCols,
      rows: bestRows,
      orientation: isRotatedBetter ? 'horizontal' : 'vertical',
      paperUtilizationPercent: utilization,
      cuttingGapMm,
      marginMm,
      estimatedSavingPercent: savingPercent,
      totalSheetsFor1000Items: totalSheetsNeeded
    };
  }
}
