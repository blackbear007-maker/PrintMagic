import { jsPDF } from 'jspdf';
import type { CropAnchor, PrintPreset } from '../types';
import { iccProfileEngine } from '../core/icc-profiles';
import { CmykConversionClient } from '../services/cmyk-conversion-client';
import { CmykPdfWriter, type CmykRaster } from './cmyk-pdf-writer';
import { coverFit, trimForImage } from '../core/print-layout';

export interface PrintPdfResult {
  blob: Blob;
  colorMode: 'cmyk' | 'rgb';
  /** CMYK only: the printing condition the separation targets, e.g. "Japan Color 2001 Coated". */
  outputCondition?: string;
  /** CMYK only: highest total ink coverage in the separation (%). */
  tacMaxPercent?: number;
  /** RGB only: why the CMYK path was not used. */
  fallbackReason?: string;
}

/**
 * Commercial Print PDF Exporter
 *
 * 2026-09-25：先把成品送去自建分色服務轉成 CMYK（依色彩描述檔選單，Adobe 的印刷描述檔 + LittleCMS），
 * 用 CmykPdfWriter 輸出 CMYK PDF；服務不可用時（本機模式、後端離線）才退回下面 buildPdf() 的 RGB 版面，
 * 由印刷廠自行轉檔。兩種版面的出血、裁切標記、規矩線、色條位置相同。呼叫端要看回傳的 colorMode
 * 決定怎麼跟使用者／印刷廠說明，不能再假設一律是 RGB 或 CMYK。
 */
export class PdfExporter {
  /** The most recent PDF this exporter produced, so later copy (spec sheet) states what the shop actually got. */
  public static lastResult: PrintPdfResult | null = null;

  /**
   * 產生並下載 PDF；與 generatePdfBlob 共用同一份流程（generate），避免兩條路徑輸出不一致。
   * 傳陣列時每張圖一頁（雙面合版：[正面, 背面]）。
   */
  public static async export(
    imageDataUrl: string | string[],
    preset: PrintPreset,
    filename?: string,
    cropAnchor: CropAnchor = 'center'
  ): Promise<PrintPdfResult> {
    const saveName = filename || `PrintMagic_${preset.id}_${Date.now()}.pdf`;
    const result = await this.generate(imageDataUrl, preset, saveName.replace(/\.pdf$/i, ''), cropAnchor);
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.download = saveName;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return result;
  }

  /**
   * Generate PDF Blob without triggering auto-download (for ZIP packaging)
   */
  public static async generatePdfBlob(
    imageDataUrl: string,
    preset: PrintPreset,
    cropAnchor: CropAnchor = 'center'
  ): Promise<Blob> {
    return (await this.generate(imageDataUrl, preset, undefined, cropAnchor)).blob;
  }

  /**
   * CMYK when the separation service answers for every page, otherwise the RGB layout for all pages
   * (a job is never half CMYK, half RGB).
   */
  public static async generate(
    imageDataUrl: string | string[],
    preset: PrintPreset,
    title?: string,
    cropAnchor: CropAnchor = 'center'
  ): Promise<PrintPdfResult> {
    const imageDataUrls = Array.isArray(imageDataUrl) ? imageDataUrl : [imageDataUrl];
    const profileId = iccProfileEngine.getActiveProfile().id;
    const rasters: CmykRaster[] = [];
    let fallbackReason: string | undefined;
    for (const url of imageDataUrls) {
      const cmyk = await CmykConversionClient.convert(url, profileId);
      if (!cmyk.ok) {
        fallbackReason = cmyk.reason;
        break;
      }
      rasters.push(cmyk.raster);
    }

    const result: PrintPdfResult = fallbackReason === undefined
      ? {
          blob: new Blob([CmykPdfWriter.build({ preset, pages: rasters, anchor: cropAnchor, title: title || `PrintMagic ${preset.id}` })], {
            type: 'application/pdf'
          }),
          colorMode: 'cmyk',
          outputCondition: rasters[0].outputCondition,
          tacMaxPercent: Math.max(...rasters.map((r) => r.tacMaxPercent ?? 0))
        }
      : { blob: this.buildPdf(imageDataUrls, preset, cropAnchor).output('blob'), colorMode: 'rgb', fallbackReason };
    if (fallbackReason !== undefined) console.info('[PdfExporter] CMYK separation unavailable, exporting RGB:', fallbackReason);
    this.lastResult = result;
    return result;
  }

  private static buildPdf(imageDataUrls: string[], preset: PrintPreset, cropAnchor: CropAnchor): jsPDF {
    // Each page is laid out from its own image (print-layout.ts, 2026-09-26): trim turned to the
    // image's orientation, image scaled to cover trim + bleed and clipped — it used to be stretched
    // into the preset's fixed orientation. Image sizes are read first because jsPDF fixes the first
    // page's format at construction.
    const probe = new jsPDF();
    const pages = imageDataUrls.map((imageDataUrl) => {
      const { width, height } = probe.getImageProperties(imageDataUrl);
      const trim = trimForImage(preset, width, height);
      const outerMarginMm = preset.cropMarks ? 12 : 0;
      return {
        imageDataUrl,
        width,
        height,
        bleedMm: trim.bleedMm,
        trimWidthMm: trim.widthMm,
        trimHeightMm: trim.heightMm,
        outerMarginMm,
        pageTotalWidthMm: trim.widthMm + (trim.bleedMm + outerMarginMm) * 2,
        pageTotalHeightMm: trim.heightMm + (trim.bleedMm + outerMarginMm) * 2
      };
    });
    const orientationOf = (p: (typeof pages)[number]) => (p.pageTotalWidthMm > p.pageTotalHeightMm ? 'landscape' : 'portrait');

    const pdf = new jsPDF({
      orientation: orientationOf(pages[0]),
      unit: 'mm',
      format: [pages[0].pageTotalWidthMm, pages[0].pageTotalHeightMm]
    });

    pages.forEach((page, pageIndex) => {
      const { imageDataUrl, bleedMm, trimWidthMm, trimHeightMm, outerMarginMm, pageTotalWidthMm, pageTotalHeightMm } = page;
      if (pageIndex > 0) pdf.addPage([pageTotalWidthMm, pageTotalHeightMm], orientationOf(page));

      // Content placement coordinates (includes bleed)
      const contentX = outerMarginMm;
      const contentY = outerMarginMm;
      const contentWidth = trimWidthMm + bleedMm * 2;
      const contentHeight = trimHeightMm + bleedMm * 2;

      // 0. Sticker: plain RGB white backing so transparent areas print as white. This is NOT a
      //    white-ink spot plate (that one comes from the dieline tool as a separate file).
      if (preset.id === 'sticker') {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(contentX, contentY, contentWidth, contentHeight, 'F');
      }

      // 1. Draw Image — scaled to cover trim + bleed without distortion, clipped to it
      const fit = coverFit(contentWidth, contentHeight, page.width, page.height, cropAnchor);
      pdf.saveGraphicsState();
      pdf.rect(contentX, contentY, contentWidth, contentHeight, null);
      pdf.clip();
      pdf.discardPath();
      pdf.addImage(
        imageDataUrl,
        'PNG',
        contentX + fit.x,
        contentY + fit.y,
        fit.width,
        fit.height,
        undefined,
        'FAST'
      );
      pdf.restoreGraphicsState();

      // Trim box origin relative to page
      const trimX = outerMarginMm + bleedMm;
      const trimY = outerMarginMm + bleedMm;

      // 2. Draw 0.1mm Vector Crop Marks
      if (preset.cropMarks) {
        pdf.setLineWidth(0.1); // 0.1mm standard line weight
        pdf.setDrawColor(0, 0, 0); // Registration Black

        const markLen = 6; // 6mm mark length
        // 角線需從出血外緣再退 1.5mm，才不會畫進出血區的圖面上
        const markOffset = bleedMm + 1.5;

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
          pdf.line(pos.x, pos.y - 3.5, pos.x, pos.y + 3.5);
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
      // English preset name: jsPDF's built-in font has no CJK glyphs, so nameZh printed as mojibake.
      const metaText = `PrintMagic v3.1 | ${preset.name} (${trimWidthMm}x${trimHeightMm}mm) | Bleed: ${bleedMm}mm | ${preset.targetDpi} DPI | Date: ${dateStr}`;
      pdf.text(metaText, trimX, pageTotalHeightMm - outerMarginMm / 2 + 2);
    });

    return pdf;
  }

  /**
   * Generate PDF and return as base64 Data URL
   */
  public static async exportToDataUrl(
    imageDataUrl: string,
    preset: PrintPreset,
    _filename?: string,
    cropAnchor: CropAnchor = 'center'
  ): Promise<string> {
    const blob = await this.generatePdfBlob(imageDataUrl, preset, cropAnchor);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
