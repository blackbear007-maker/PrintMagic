import { jsPDF } from 'jspdf';
import { createHash } from 'crypto';
import { IccService } from './icc-service.js';

export interface PdfxExportOptions {
  imageDataUrl: string;
  preset: {
    id: string;
    nameZh: string;
    widthMm: number;
    heightMm: number;
    bleedMm: number;
    targetDpi: number;
    cropMarks?: boolean;
    colorBars?: boolean;
    registrationMarks?: boolean;
  };
  iccProfileId?: string;
  pdfStandard?: 'PDF/X-1a:2001' | 'PDF/X-4';
  artworkName?: string;
}

export class PdfxService {
  public static async generatePdfx(options: PdfxExportOptions): Promise<{
    buffer: Buffer;
    checksum: string;
    fileName: string;
    standard: string;
    iccName: string;
  }> {
    const { imageDataUrl, preset, iccProfileId = 'japan-color-2001', pdfStandard = 'PDF/X-1a:2001', artworkName = 'Artwork' } = options;
    const icc = IccService.getProfile(iccProfileId);

    const bleedMm = preset.bleedMm || 0;
    const trimWidthMm = preset.widthMm > 0 ? preset.widthMm : 210;
    const trimHeightMm = preset.heightMm > 0 ? preset.heightMm : 297;

    const outerMarginMm = 12; // Outer margin for crop marks and slug
    const pageTotalWidthMm = trimWidthMm + (bleedMm + outerMarginMm) * 2;
    const pageTotalHeightMm = trimHeightMm + (bleedMm + outerMarginMm) * 2;

    const orientation = trimWidthMm > trimHeightMm ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [pageTotalWidthMm, pageTotalHeightMm]
    });

    // Content box with bleed
    const contentX = outerMarginMm;
    const contentY = outerMarginMm;
    const contentWidth = trimWidthMm + bleedMm * 2;
    const contentHeight = trimHeightMm + bleedMm * 2;

    // Real SHA-256 of the source artwork bytes — a genuine, reproducible content fingerprint.
    // (Not a "防偽舉證"/anti-counterfeit certificate and not a hash of the final PDF — computed
    // from the source image before this function draws anything, since jsPDF doesn't let us hash
    // the finished buffer and then also print that hash onto the page.)
    const base64Payload = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const sha256 = createHash('sha256').update(Buffer.from(base64Payload, 'base64')).digest('hex').toUpperCase();

    // 1. Draw raster artwork
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

    const trimX = outerMarginMm + bleedMm;
    const trimY = outerMarginMm + bleedMm;

    // 2. Vector 0.1mm Pre-Press Crop Marks
    pdf.setLineWidth(0.1);
    pdf.setDrawColor(0, 0, 0); // Registration 100%

    const markLen = 6;
    const markOffset = 1.5;

    // Top-Left
    pdf.line(trimX - markOffset - markLen, trimY, trimX - markOffset, trimY);
    pdf.line(trimX, trimY - markOffset - markLen, trimX, trimY - markOffset);

    // Top-Right
    pdf.line(trimX + trimWidthMm + markOffset, trimY, trimX + trimWidthMm + markOffset + markLen, trimY);
    pdf.line(trimX + trimWidthMm, trimY - markOffset - markLen, trimX + trimWidthMm, trimY - markOffset);

    // Bottom-Left
    pdf.line(trimX - markOffset - markLen, trimY + trimHeightMm, trimX - markOffset, trimY + trimHeightMm);
    pdf.line(trimX, trimY + trimHeightMm + markOffset, trimX, trimY + trimHeightMm + markOffset + markLen);

    // Bottom-Right
    pdf.line(trimX + trimWidthMm + markOffset, trimY + trimHeightMm, trimX + trimWidthMm + markOffset + markLen, trimY + trimHeightMm);
    pdf.line(trimX + trimWidthMm, trimY + trimHeightMm + markOffset, trimX + trimWidthMm, trimY + trimHeightMm + markOffset + markLen);

    // 3. Registration Targets
    const targets = [
      { x: trimX + trimWidthMm / 2, y: outerMarginMm / 2 },
      { x: trimX + trimWidthMm / 2, y: pageTotalHeightMm - outerMarginMm / 2 },
      { x: outerMarginMm / 2, y: trimY + trimHeightMm / 2 },
      { x: pageTotalWidthMm - outerMarginMm / 2, y: trimY + trimHeightMm / 2 }
    ];

    for (const t of targets) {
      pdf.circle(t.x, t.y, 2);
      pdf.line(t.x - 3.5, t.y, t.x + 3.5, t.y);
      pdf.line(t.x, t.y - 3.5, t.x, t.y + 3.5);
    }

    // 4. CMYK 8-Step Calibration Bars
    const barY = outerMarginMm / 2 - 1.5;
    const barSize = 3;
    const colors = [
      { r: 0, g: 174, b: 239 },
      { r: 236, g: 0, b: 140 },
      { r: 255, g: 242, b: 0 },
      { r: 35, g: 31, b: 32 },
      { r: 128, g: 215, b: 247 },
      { r: 246, g: 128, b: 198 },
      { r: 255, g: 248, b: 128 },
      { r: 145, g: 143, b: 144 }
    ];

    const startX = trimX + 5;
    colors.forEach((c, idx) => {
      pdf.setFillColor(c.r, c.g, c.b);
      pdf.rect(startX + idx * (barSize + 0.5), barY, barSize, barSize, 'F');
    });

    // 5. Pre-Press Metadata Slug
    //
    // Honesty note: this is NOT a validated PDF/X-1a / ISO 15930 file. Real PDF/X-1a requires an
    // OutputIntent dictionary with an embedded ICC profile, CMYK-only content, and zero
    // transparency — none of which this function does (the artwork above is embedded as-is,
    // still RGB, no OutputIntent, no embedded ICC). The `pdfStandard` label below is descriptive
    // metadata only, not a compliance claim. The color-bar swatches and crop/registration marks
    // ARE real vector content, correctly positioned.
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    pdf.setFontSize(6);
    pdf.setTextColor(80, 80, 80);

    const slugLine1 = `PrintMagic Pre-Press PDF (RGB content, not a validated PDF/X file) | ${preset.nameZh} (${trimWidthMm}×${trimHeightMm}mm) | Bleed: ${bleedMm}mm | Reference profile: ${icc.name} (${icc.standard})`;
    const slugLine2 = `Source artwork SHA-256: ${sha256} | Generated: ${timestamp} UTC`;

    pdf.text(slugLine1, trimX, pageTotalHeightMm - outerMarginMm / 2 + 1);
    pdf.text(slugLine2, trimX, pageTotalHeightMm - outerMarginMm / 2 + 4.5);

    const arrayBuffer = pdf.output('arraybuffer');
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `PrintMagic_${artworkName}_${pdfStandard.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    return {
      buffer,
      checksum: sha256,
      fileName,
      standard: pdfStandard,
      iccName: icc.name
    };
  }
}
