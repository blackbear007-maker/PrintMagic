import JSZip from 'jszip';
import { PdfExporter } from './pdf-exporter';
import { TiffExporter } from './tiff-exporter';
import type { AppState } from '../ui/state';
import { Toast } from '../ui/toast';
import { SoundEffects } from '../core/sound-effects';

export type ExportFormatType = 'pdf' | 'tiff' | 'png' | 'jpg' | 'zip';

export class MultiFormatExporter {
  /**
   * Generates sanitized standard print-shop filename
   */
  public static getBaseFilename(state: AppState): string {
    const preset = state.currentPreset;
    const cleanPreset = preset.nameZh.replace(/\s+/g, '_');
    const width = preset.widthMm;
    const height = preset.heightMm;
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `[PrintMagic]_${cleanPreset}_${width}x${height}mm_${timestamp}`;
  }

  /**
   * Export single format or full production bundle
   */
  public static async exportFormat(
    format: ExportFormatType,
    state: AppState
  ): Promise<void> {
    const imgData = state.processedImageData || state.originalImageData;
    const dataUrl = state.processedDataUrl || state.originalDataUrl;

    if (!imgData || !dataUrl) {
      Toast.error('尚未載入或處理完成任何圖片，無法匯出');
      return;
    }

    const baseName = this.getBaseFilename(state);
    SoundEffects.shutterClick();

    switch (format) {
      case 'pdf': {
        Toast.info('📄 正在壓製 300 DPI 標準印刷 PDF...');
        await PdfExporter.export(dataUrl, state.currentPreset, `${baseName}.pdf`, state.cropAnchor);
        Toast.success('✓ 300 DPI 標準印刷 PDF 已成功下載！');
        break;
      }

      case 'tiff': {
        Toast.info('🖨️ 正在編碼 300 DPI 工業無損 TIFF 影像...');
        TiffExporter.downloadTiff(imgData, `${baseName}.tif`, 300);
        Toast.success('✓ 300 DPI 工業無損 TIFF 檔已成功下載！');
        break;
      }

      case 'png': {
        Toast.info('📥 正在下載 300 DPI 高解析度 PNG...');
        this.downloadDataUrl(dataUrl, `${baseName}.png`);
        Toast.success('✓ 高解析度 PNG 已成功下載！');
        break;
      }

      case 'jpg': {
        Toast.info('🖼️ 正在轉換 300 DPI 高畫質 JPEG...');
        const jpgDataUrl = this.convertToJpeg(imgData, 0.98);
        this.downloadDataUrl(jpgDataUrl, `${baseName}.jpg`);
        Toast.success('✓ 300 DPI 高畫質 JPG 已成功下載！');
        break;
      }

      case 'zip': {
        Toast.info('📦 正在打包印刷廠出機全套包 (PDF + TIFF + PNG + JPG + 檢查清單)...');
        await this.exportFullZipBundle(state, baseName);
        Toast.success('✓ 印刷廠出機全套包 ZIP 已成功打包下載！');
        break;
      }
    }
  }

  /**
   * One-click bundles all print formats into a complete production ZIP
   */
  public static async exportFullZipBundle(
    state: AppState,
    baseName: string
  ): Promise<void> {
    const imgData = state.processedImageData || state.originalImageData;
    const dataUrl = state.processedDataUrl || state.originalDataUrl;
    if (!imgData || !dataUrl) return;

    const zip = new JSZip();
    const folder = zip.folder(baseName) || zip;

    // 1. TIFF File (300 DPI)
    const tiffBlob = TiffExporter.encodeTiffBlob(imgData, 300);
    folder.file(`${baseName}_300DPI.tif`, tiffBlob);

    // 2. PNG File (300 DPI)
    const pngBase64 = dataUrl.split(',')[1];
    folder.file(`${baseName}_300DPI.png`, pngBase64, { base64: true });

    // 3. JPG File (300 DPI)
    const jpgDataUrl = this.convertToJpeg(imgData, 0.98);
    folder.file(`${baseName}_300DPI.jpg`, jpgDataUrl.split(',')[1], { base64: true });

    // 3b. Print-ready PDF (含出血/角線，與 PDF 匯出同一份繪製邏輯)
    const pdfResult = await PdfExporter.generate(dataUrl, state.currentPreset, `${baseName}_print`, state.cropAnchor);
    folder.file(`${baseName}_print.pdf`, pdfResult.blob);
    const pdfIsCmyk = pdfResult.colorMode === 'cmyk';

    // 5. Pre-press Inspection Report (本機自動檢查清單，非第三方獨立驗證/合格證書)
    const preset = state.currentPreset;
    const nowStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const reportText = `════════════════════════════════════════════════════════════════════════════
📋 PrintMagic 商業印前出機檔案清單（本機自動檢查，非第三方獨立驗證）
════════════════════════════════════════════════════════════════════════════
出機日期：${nowStr}
成品規格：${preset.nameZh} (${preset.widthMm} × ${preset.heightMm} mm)
含出血總尺寸：${preset.widthMm + preset.bleedMm * 2} × ${preset.heightMm + preset.bleedMm * 2} mm
目標解析度：${preset.targetDpi} DPI
${pdfIsCmyk
  ? `色彩狀態：送印 PDF 為 CMYK（依 ${pdfResult.outputCondition} 分色，總墨量最高 ${pdfResult.tacMaxPercent}%；描述檔未嵌入，PDF 內以 OutputIntent 註明印刷條件）；TIFF/PNG/JPG 仍為 RGB`
  : '色彩狀態：RGB（分色服務本次無法使用，尚未做 CMYK 分色，印刷廠仍需依標準流程轉換）'}

【全套包內容物明細】
1. ${baseName}_300DPI.tif        -> 300 DPI 無損 TIFF 點陣檔（RGB）
2. ${baseName}_300DPI.png        -> 300 DPI 高清透明通道 PNG (貼紙/立牌預覽)
3. ${baseName}_300DPI.jpg        -> 300 DPI 高畫質 JPEG
4. ${baseName}_print.pdf         -> 送印 PDF（${pdfIsCmyk ? 'CMYK' : 'RGB'}，含出血與印刷標記）
5. Readme_印前檢驗報告.txt      -> 本檢查清單

【印刷廠師傅出機指引】
• ${preset.bleedMm > 0 ? `成品規格含單邊 ${preset.bleedMm}mm 出血（見上方含出血總尺寸）` : '此規格無出血'}；點陣檔為處理後原圖，請直接以 100% 比例出機，切勿任意縮放。
════════════════════════════════════════════════════════════════════════════`;
    folder.file('Readme_印前檢驗報告.txt', reportText);

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    this.downloadBlob(zipBlob, `${baseName}_印刷廠全套出機包.zip`);
  }

  private static convertToJpeg(imageData: ImageData, quality = 0.98): string {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;

    // White background for transparent pixels. putImageData overwrites instead of compositing, so the
    // pixels go through a second canvas and drawImage (2026-09-26: transparent areas came out black).
    const src = document.createElement('canvas');
    src.width = imageData.width;
    src.height = imageData.height;
    src.getContext('2d')!.putImageData(imageData, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0);

    return canvas.toDataURL('image/jpeg', quality);
  }

  private static downloadDataUrl(dataUrl: string, filename: string): void {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  private static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
