import JSZip from 'jszip';
import { PdfExporter } from './pdf-exporter';
import { TiffExporter } from './tiff-exporter';
import type { AppState } from '../ui/state';
import { Toast } from '../ui/toast';
import { SoundEffects } from '../core/sound-effects';

export type ExportFormatType = 'pdf' | 'tiff' | 'png' | 'jpg' | 'svg' | 'zip';

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
        await PdfExporter.export(dataUrl, state.currentPreset, `${baseName}.pdf`);
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

      case 'svg': {
        Toast.info('✂️ 正在生成 100% 洋紅印刷刀模 SVG 檔...');
        const svgContent = this.generateCutlineSvg(state);
        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        this.downloadBlob(svgBlob, `${baseName}_刀模層.svg`);
        Toast.success('✓ 向量刀模 SVG 已成功下載！');
        break;
      }

      case 'zip': {
        Toast.info('📦 正在打包印刷廠出機全套包 (PDF + TIFF + PNG + 刀模 + 報告)...');
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

    // 4. SVG Dieline Layer
    const svgContent = this.generateCutlineSvg(state);
    folder.file(`${baseName}_刀模層_Magenta.svg`, svgContent);

    // 5. Pre-press Inspection Report (本機自動檢查清單，非第三方獨立驗證/合格證書)
    const preset = state.currentPreset;
    const nowStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const inkLimitApplied = state.pipelineOptions?.enableInkLimiting !== false;
    const actualTac = state.inkAnalysis?.maxTotalInk;
    const inkLine = inkLimitApplied
      ? `油墨限制：${actualTac !== undefined ? `實測最高 ${actualTac}%` : '已啟用 TAC ≤ 300% 控墨'} (防背面沾黏安全控墨)`
      : '油墨限制：本次匯出未啟用 TAC 控墨（可於管線設定開啟）';
    const reportText = `════════════════════════════════════════════════════════════════════════════
📋 PrintMagic 商業印前出機檔案清單（本機自動檢查，非第三方獨立驗證）
════════════════════════════════════════════════════════════════════════════
出機日期：${nowStr}
成品規格：${preset.nameZh} (${preset.widthMm} × ${preset.heightMm} mm)
含出血總尺寸：${preset.widthMm + preset.bleedMm * 2} × ${preset.heightMm + preset.bleedMm * 2} mm
實體輸出解析度：300 DPI (視網膜印刷級)
${inkLine}
色彩狀態：RGB（尚未做 CMYK 分色，印刷廠仍需依標準流程轉換；Japan Color 2001 Coated / FOGRA39 僅供參考，非嵌入描述檔）

【全套包內容物明細】
1. ${baseName}_300DPI.tif        -> 300 DPI 工業級無損 TIFF 點陣檔 (分色輸出首選)
2. ${baseName}_300DPI.png        -> 300 DPI 高清透明通道 PNG (貼紙/立牌預覽)
3. ${baseName}_300DPI.jpg        -> 300 DPI 高畫質 JPEG
4. ${baseName}_刀模層_Magenta.svg -> 100% 洋紅 2mm 向量割字激光刀模線
5. Readme_印前檢驗報告.txt      -> 本檢查清單

【印刷廠師傅出機指引】
• 本套件已依 1:1 實體尺寸內建 3mm 物理出血與安全框，請直接以 100% 比例出機，切勿任意縮放。
• 刀模線請套用 Spot Magenta (洋紅專色) 進行激光切割或鋼刀壓痕。
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

    // Fill white background for transparent pixels
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/jpeg', quality);
  }

  private static generateCutlineSvg(state: AppState): string {
    const preset = state.currentPreset;
    const totalW = preset.widthMm + preset.bleedMm * 2;
    const totalH = preset.heightMm + preset.bleedMm * 2;
    const bleed = preset.bleedMm;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}mm" height="${totalH}mm" viewBox="0 0 ${totalW} ${totalH}">
  <!-- 100% Magenta 印刷裁切刀模線 -->
  <rect x="${bleed}" y="${bleed}" width="${preset.widthMm}" height="${preset.heightMm}" fill="none" stroke="#FF00FF" stroke-width="0.25mm" stroke-dasharray="2,1" />
  <!-- 外圍 3mm 出血框 -->
  <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="none" stroke="#00FFFF" stroke-width="0.15mm" />
</svg>`;
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
