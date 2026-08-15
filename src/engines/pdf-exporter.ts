import { jsPDF } from 'jspdf';
import type { CropAnchor, PrintPreset } from '../types';

/**
 * Commercial Print PDF Exporter
 * Generates ISO pre-press ready PDFs with precise 0.1mm vector crop marks, bleed, color bars, and registration targets
 */
export class PdfExporter {
  public static async export(
    imageDataUrl: string,
    preset: PrintPreset,
    filename?: string,
    _cropAnchor: CropAnchor = 'center'
  ): Promise<Blob> {
    const bleedMm = preset.bleedMm || 0;
    const trimWidthMm = preset.widthMm > 0 ? preset.widthMm : 210;
    const trimHeightMm = preset.heightMm > 0 ? preset.heightMm : 297;

    // Outer margin around bleed to hold crop marks and color bars
    const outerMarginMm = preset.cropMarks ? 12 : 0;
    const pageTotalWidthMm = trimWidthMm + (bleedMm + outerMarginMm) * 2;
    const pageTotalHeightMm = trimHeightMm + (bleedMm + outerMarginMm) * 2;

    const orientation = trimWidthMm > trimHeightMm ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [pageTotalWidthMm, pageTotalHeightMm]
    });

    // Content placement coordinates (includes bleed)
    const contentX = outerMarginMm;
    const contentY = outerMarginMm;
    const contentWidth = trimWidthMm + bleedMm * 2;
    const contentHeight = trimHeightMm + bleedMm * 2;

    // 1. Draw Image
    pdf.addImage(
      imageDataUrl,
      'PNG',
      contentX,
      contentY,
      contentWidth,
      contentHeight,
      undefined,
      'FAST'
    );

    // Trim box origin relative to page
    const trimX = outerMarginMm + bleedMm;
    const trimY = outerMarginMm + bleedMm;

    // 2. Draw 0.1mm Vector Crop Marks
    if (preset.cropMarks) {
      pdf.setLineWidth(0.1); // 0.1mm standard line weight
      pdf.setDrawColor(0, 0, 0); // Registration Black

      const markLen = 6; // 6mm mark length
      const markOffset = 1.5; // 1.5mm offset from trim line

      // Top-Left Corner
      pdf.line(trimX - markOffset - markLen, trimY, trimX - markOffset, trimY); // horizontal
      pdf.line(trimX, trimY - markOffset - markLen, trimX, trimY - markOffset); // vertical

      // Top-Right Corner
      pdf.line(trimX + trimWidthMm + markOffset, trimY, trimX + trimWidthMm + markOffset + markLen, trimY);
      pdf.line(trimX + trimWidthMm, trimY - markOffset - markLen, trimX + trimWidthMm, trimY - markOffset);

      // Bottom-Left Corner
      pdf.line(trimX - markOffset - markLen, trimY + trimHeightMm, trimX - markOffset, trimY + trimHeightMm);
      pdf.line(trimX, trimY + trimHeightMm + markOffset, trimX, trimY + trimHeightMm + markOffset + markLen);

      // Bottom-Right Corner
      pdf.line(trimX + trimWidthMm + markOffset, trimY + trimHeightMm, trimX + trimWidthMm + markOffset + markLen, trimY + trimHeightMm);
      pdf.line(trimX + trimWidthMm, trimY + trimHeightMm + markOffset, trimX + trimWidthMm, trimY + trimHeightMm + markOffset + markLen);
    }

    // 3. Draw Registration Targets (Crosshairs)
    if (preset.registrationMarks) {
      pdf.setLineWidth(0.1);
      pdf.setDrawColor(0, 0, 0);

      const targetPositions = [
        { x: trimX + trimWidthMm / 2, y: outerMarginMm / 2 }, // Top center
        { x: trimX + trimWidthMm / 2, y: pageTotalHeightMm - outerMarginMm / 2 }, // Bottom center
        { x: outerMarginMm / 2, y: trimY + trimHeightMm / 2 }, // Left center
        { x: pageTotalWidthMm - outerMarginMm / 2, y: trimY + trimHeightMm / 2 } // Right center
      ];

      for (const pos of targetPositions) {
        pdf.circle(pos.x, pos.y, 2);
        pdf.line(pos.x - 3.5, pos.y, pos.x + 3.5, pos.y);
        pdf.line(pos.x - 3.5, pos.y, pos.x + 3.5, pos.y);
      }
    }

    // 4. Draw CMYK Color Density Bars
    if (preset.colorBars) {
      const barY = outerMarginMm / 2 - 1.5;
      const barSize = 3;
      const colors = [
        { name: 'C', r: 0, g: 174, b: 239 },
        { name: 'M', r: 236, g: 0, b: 140 },
        { name: 'Y', r: 255, g: 242, b: 0 },
        { name: 'K', r: 35, g: 31, b: 32 },
        { name: 'C50', r: 128, g: 215, b: 247 },
        { name: 'M50', r: 246, g: 128, b: 198 },
        { name: 'Y50', r: 255, g: 248, b: 128 },
        { name: 'K50', r: 145, g: 143, b: 144 }
      ];

      const startX = trimX + 5;
      colors.forEach((c, idx) => {
        pdf.setFillColor(c.r, c.g, c.b);
        pdf.rect(startX + idx * (barSize + 0.5), barY, barSize, barSize, 'F');
      });
    }

    // 5. Pre-press Metadata Slug
    pdf.setFontSize(6);
    pdf.setTextColor(100, 100, 100);
    const dateStr = new Date().toISOString().split('T')[0];
    const metaText = `PrintMagic v3.1 | ${preset.nameZh} (${trimWidthMm}×${trimHeightMm}mm) | Bleed: ${bleedMm}mm | ${preset.targetDpi} DPI | Date: ${dateStr}`;
    pdf.text(metaText, trimX, pageTotalHeightMm - outerMarginMm / 2 + 2);

    // Save and Trigger Download
    const saveName = filename || `PrintMagic_${preset.id}_${Date.now()}.pdf`;
    pdf.save(saveName);

    return pdf.output('blob');
  }
}
