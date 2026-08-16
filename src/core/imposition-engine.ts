import { jsPDF } from 'jspdf';

export interface ImpositionLayout {
  sheetPreset: 'A4' | 'A3';
  sheetWidthMm: number;
  sheetHeightMm: number;
  sheetWidthPx: number;
  sheetHeightPx: number;
  cols: number;
  rows: number;
  totalCells: number;
  cellWidthMm: number;
  cellHeightMm: number;
  cellWidthPx: number;
  cellHeightPx: number;
  gapMm: number;
  marginMm: number;
  costSavingsPercent: number;
}

export class ImpositionEngine {
  /**
   * Calculates optimal grid layout to maximize items per sheet (A4 or A3)
   */
  public static calculateLayout(
    itemWidthMm: number,
    itemHeightMm: number,
    sheetPreset: 'A4' | 'A3' = 'A4'
  ): ImpositionLayout {
    const isA3 = sheetPreset === 'A3';
    const sheetW = isA3 ? 297 : 210;
    const sheetH = isA3 ? 420 : 297;

    const gapMm = 3;
    const marginMm = 8;

    const printableW = sheetW - marginMm * 2;
    const printableH = sheetH - marginMm * 2;

    // Normal orientation test
    const colsNormal = Math.max(1, Math.floor((printableW + gapMm) / (itemWidthMm + gapMm)));
    const rowsNormal = Math.max(1, Math.floor((printableH + gapMm) / (itemHeightMm + gapMm)));
    const totalNormal = colsNormal * rowsNormal;

    // Rotated 90 deg test
    const colsRotated = Math.max(1, Math.floor((printableW + gapMm) / (itemHeightMm + gapMm)));
    const rowsRotated = Math.max(1, Math.floor((printableH + gapMm) / (itemWidthMm + gapMm)));
    const totalRotated = colsRotated * rowsRotated;

    let cols: number;
    let rows: number;
    let cellW: number;
    let cellH: number;

    if (totalRotated > totalNormal) {
      cols = colsRotated;
      rows = rowsRotated;
      cellW = itemHeightMm;
      cellH = itemWidthMm;
    } else {
      cols = colsNormal;
      rows = rowsNormal;
      cellW = itemWidthMm;
      cellH = itemHeightMm;
    }

    const totalCells = cols * rows;

    // Calculate cost savings compared to printing single separate copies
    // e.g. 8 items on 1 sheet -> ~75% cost savings
    const costSavingsPercent = totalCells > 1 ? Math.min(85, Math.round(((totalCells - 1) / totalCells) * 100)) : 0;

    const dpi = 300;
    const mmToPx = (mm: number) => Math.round((mm / 25.4) * dpi);

    return {
      sheetPreset,
      sheetWidthMm: sheetW,
      sheetHeightMm: sheetH,
      sheetWidthPx: mmToPx(sheetW),
      sheetHeightPx: mmToPx(sheetH),
      cols,
      rows,
      totalCells,
      cellWidthMm: cellW,
      cellHeightMm: cellH,
      cellWidthPx: mmToPx(cellW),
      cellHeightPx: mmToPx(cellH),
      gapMm,
      marginMm,
      costSavingsPercent
    };
  }

  /**
   * Generates a 300 DPI composite Imposition Canvas with crop marks & crosshairs
   */
  public static async generateImpositionCanvas(
    items: ImageData[],
    layout: ImpositionLayout,
    isRepeatSingle = true
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = layout.sheetWidthPx;
    canvas.height = layout.sheetHeightPx;
    const ctx = canvas.getContext('2d')!;

    // 1. Pure White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Sheet Info Header
    ctx.fillStyle = '#6e6e73';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(
      `PrintMagic Studio — 智慧拼模版型 [${layout.sheetPreset} / ${layout.totalCells} 模] · 300 DPI 印刷標準 · 預估節省 ${layout.costSavingsPercent}% 成本`,
      50,
      50
    );

    const dpi = 300;
    const mmToPx = (mm: number) => (mm / 25.4) * dpi;

    const cellWPx = mmToPx(layout.cellWidthMm);
    const cellHPx = mmToPx(layout.cellHeightMm);
    const gapPx = mmToPx(layout.gapMm);

    // Compute grid bounding box & center it on sheet
    const totalGridW = layout.cols * cellWPx + (layout.cols - 1) * gapPx;
    const totalGridH = layout.rows * cellHPx + (layout.rows - 1) * gapPx;

    const startX = (canvas.width - totalGridW) / 2;
    const startY = 70 + (canvas.height - 70 - totalGridH) / 2;

    // Convert items to temporary reusable canvases
    const itemCanvases = items.map((imgData) => {
      const c = document.createElement('canvas');
      c.width = imgData.width;
      c.height = imgData.height;
      const cCtx = c.getContext('2d')!;
      cCtx.putImageData(imgData, 0, 0);
      return c;
    });

    let itemIndex = 0;

    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const x = startX + c * (cellWPx + gapPx);
        const y = startY + r * (cellHPx + gapPx);

        const currentSource = isRepeatSingle
          ? itemCanvases[0]
          : itemCanvases[itemIndex % itemCanvases.length];

        if (currentSource) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(currentSource, x, y, cellWPx, cellHPx);
        }

        // Draw 0.1mm Crosshairs & Precision Crop Marks
        this.drawCellCropMarks(ctx, x, y, cellWPx, cellHPx);

        itemIndex++;
      }
    }

    // Outer Safety Border
    ctx.strokeStyle = '#d2d2d7';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX - 10, startY - 10, totalGridW + 20, totalGridH + 20);

    return canvas;
  }

  private static drawCellCropMarks(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    const markLen = 20;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x - markLen, y);
    ctx.lineTo(x, y);
    ctx.moveTo(x, y - markLen);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + markLen, y);
    ctx.moveTo(x + w, y - markLen);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x - markLen, y + h);
    ctx.lineTo(x, y + h);
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h + markLen);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + w, y + h);
    ctx.lineTo(x + w + markLen, y + h);
    ctx.moveTo(x + w, y + h);
    ctx.lineTo(x + w, y + h + markLen);
    ctx.stroke();
  }

  /**
   * Generates a ready-to-print Imposition PDF file
   */
  public static async generateImpositionPdf(canvas: HTMLCanvasElement, sheetPreset: 'A4' | 'A3'): Promise<Blob> {
    const isA3 = sheetPreset === 'A3';
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isA3 ? 'a3' : 'a4'
    });

    const pageW = isA3 ? 297 : 210;
    const pageH = isA3 ? 420 : 297;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.96);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH);

    return pdf.output('blob');
  }
}
