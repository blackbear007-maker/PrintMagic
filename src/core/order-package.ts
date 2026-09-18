import JSZip from 'jszip';
import type { PrintPreset } from '../types';
import type { AppState } from '../ui/state';
import type { PrintQuoteResult } from './print-pricing';

/** 合版印刷總墨量安全上限 (%) */
const TAC_LIMIT = 300;

export interface OrderPackageResult {
  zipBlob: Blob;
  zipFilename: string;
  pdfFilename: string;
  reportFilename: string;
  specFilename: string;
  copyableSpecText: string;
}

export class OrderPackageGenerator {
  /**
   * Format standard print shop compliant file name
   * Example: [健豪]_A4海報_250P頂級雙霧_50張_正面_PrintMagic.pdf
   */
  public static formatPdfFilename(
    artworkName: string,
    shopShortName: string,
    preset: PrintPreset,
    paperName: string,
    quantity: number
  ): string {
    const cleanArt = (artworkName || 'Artwork').replace(/[^\w\u4e00-\u9fa5-_]/g, '_');
    const cleanPaper = paperName.split(' ')[0] || paperName;
    const cleanPreset = preset.nameZh.split(' ')[0] || preset.nameZh;
    return `[${shopShortName}]_${cleanArt}_${cleanPreset}_${cleanPaper}_${quantity}張_正面_PrintMagic.pdf`;
  }

  /**
   * Generate PrintPass™ Quality & Pre-Press Certification Report Text
   */
  public static generatePrintPassReport(
    state: AppState,
    quote: PrintQuoteResult
  ): string {
    const preset = state.currentPreset;
    // 不再以預設值冒充檢測結果：沒跑過分析就明確標示「未檢測」
    const dpi = state.dpiAnalysis?.currentDpi ?? null;
    const tac = state.inkAnalysis?.maxTotalInk ?? null;
    const score = state.scoreResult?.score ?? null;
    const dpiLine = dpi == null
      ? '[—] 實體輸出解析度：未檢測'
      : dpi >= 300
        ? `[✓] 實體輸出解析度：${dpi} DPI (達商業 300 DPI 門檻)`
        : `[!] 實體輸出解析度：${dpi} DPI (低於商業 300 DPI 門檻，可能出現像素鋸齒)`;
    const tacLine = tac == null
      ? '[—] 總墨量 (TAC)：未檢測'
      : tac <= TAC_LIMIT
        ? `[✓] 總墨量 (TAC)：最高 ${tac}% (未超過合版安全上限 ${TAC_LIMIT}%)`
        : `[!] 總墨量 (TAC)：最高 ${tac}% (超過合版安全上限 ${TAC_LIMIT}%，有沾黏風險)`;
    const marksLine = preset.cropMarks || preset.colorBars || preset.registrationMarks
      ? `[✓] 印刷標記：${[preset.cropMarks && '裁切角線', preset.colorBars && '四色濃度條', preset.registrationMarks && '十字套準規'].filter(Boolean).join('、')}（PDF 輸出時加入）`
      : '[—] 印刷標記：此規格不加裁切/套準標記';
    const totalW = preset.widthMm + preset.bleedMm * 2;
    const totalH = preset.heightMm + preset.bleedMm * 2;
    const nowStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

    return `════════════════════════════════════════════════════════════════════════════
🎖️ PrintPass™ 數位印前品質檢驗報告書 (Print Inspection Passport)
════════════════════════════════════════════════════════════════════════════
產生系統：PrintMagic Studio 3.1 Pro（本機自動檢查，非第三方獨立驗證）
產生時間：${nowStr} (台北時間)
指定印刷廠：${quote.shopName}
印前檢查分數：${score == null ? '未檢測' : `${score} / 100 分`}（尺寸/出血/DPI/墨量已檢查；顏色仍為 RGB，印刷廠仍須執行 CMYK 分色）

─────────────────────────────────────────────────────────────
【一、 印刷工單規格確認】
─────────────────────────────────────────────────────────────
■ 輸出項目：${preset.nameZh}
■ 成品淨尺寸：${preset.widthMm} × ${preset.heightMm} mm
■ 含出血尺寸：${totalW} × ${totalH} mm (標準單邊 ${preset.bleedMm}mm 物理出血)
■ 選用紙材：${quote.paperName}
■ 印製數量：${quote.quantity} 張
■ 預估總額：NT$ ${quote.totalPriceNTD} 元 (平均每張 NT$ ${quote.unitPriceNTD} 元)
■ 預估交期：${quote.leadTimeFormatted}

─────────────────────────────────────────────────────────────
【二、 工業級印前技術指標驗證】
─────────────────────────────────────────────────────────────
${dpiLine}
${tacLine}
[!] 色彩空間：檔案為 RGB，尚未做 CMYK 分色（請印刷廠依標準流程轉換，建議參考 Japan Color 2001 Coated）
${marksLine}

─────────────────────────────────────────────────────────────
【三、 給印刷廠師傅 / 審檔人員的備註說明】
─────────────────────────────────────────────────────────────
1. 本檔案已按 1:1 實體尺寸完成含出血落版，請直接以 100% 比例輸出，勿縮放。
2. 檔案顏色為 RGB，尚未經過 CMYK 分色，請依貴廠標準流程執行 RGB 轉 CMYK 補償，勿當作已轉換過。
3. 若有局部上光或燙金等特殊加工需求，可依此標準角線建立加工黑版。

─────────────────────────────────────────────────────────────
PrintMagic Studio · 讓每一張 AI 創作，完美化為實體藝術品。
官網：https://print.mrbear.app
════════════════════════════════════════════════════════════════════════════`;
  }

  /**
   * Generate quick copyable text for LINE or print shop order form
   */
  public static generateCopyableSpec(
    state: AppState,
    quote: PrintQuoteResult
  ): string {
    const preset = state.currentPreset;
    const totalW = preset.widthMm + preset.bleedMm * 2;
    const totalH = preset.heightMm + preset.bleedMm * 2;
    const dpi = state.dpiAnalysis?.currentDpi;
    const tac = state.inkAnalysis?.maxTotalInk;
    const dpiText = dpi == null ? '未檢測' : `${dpi} DPI`;
    const tacText = tac == null ? '未檢測' : `${tac}%${tac <= TAC_LIMIT ? '' : `（超過 ${TAC_LIMIT}% 上限）`}`;

    return `【PrintMagic 送印工單備註 — 指定廠商：${quote.shopName}】
■ 輸出項目：${preset.nameZh}
■ 成品尺寸：${preset.widthMm} × ${preset.heightMm} mm (含出血 ${totalW}×${totalH} mm)
■ 紙材規格：${quote.paperName}
■ 印製數量：${quote.quantity} 張
■ 實體解析度：${dpiText}
■ 總墨量 TAC：${tacText}
■ 裁切標記：${preset.cropMarks ? '含出血角線' : '無'}${preset.registrationMarks ? '、十字套準標記' : ''}
■ 色彩狀態：RGB（尚未做 CMYK 分色，請印刷廠依標準流程處理）`;
  }

  /**
   * Package PDF, PrintPass report, and order spec into a downloadable ZIP
   */
  public static async createOrderZip(
    pdfDataUrl: string,
    state: AppState,
    quote: PrintQuoteResult,
    artworkName: string
  ): Promise<OrderPackageResult> {
    const zip = new JSZip();

    const shopShort = quote.shopName.split(' ')[0] || '印刷廠';
    const pdfFilename = this.formatPdfFilename(
      artworkName,
      shopShort,
      state.currentPreset,
      quote.paperName,
      quote.quantity
    );
    const reportFilename = `PrintPass_品質檢驗報告書_${shopShort}.txt`;
    const specFilename = `送印規格與店家下單備註_${shopShort}.txt`;

    // 1. Add PDF
    const base64Data = pdfDataUrl.replace(/^data:application\/pdf;base64,/, '');
    zip.file(pdfFilename, base64Data, { base64: true });

    // 2. Add PrintPass Report
    const reportContent = this.generatePrintPassReport(state, quote);
    zip.file(reportFilename, reportContent);

    // 3. Add Quick Spec Text
    const specContent = this.generateCopyableSpec(state, quote);
    zip.file(specFilename, specContent);

    // 4. Generate ZIP blob
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const cleanArt = (artworkName || 'Artwork').replace(/[^\w\u4e00-\u9fa5-_]/g, '_');
    const zipFilename = `PrintMagic_送印封包_${cleanArt}_${shopShort}_${quote.quantity}張.zip`;

    return {
      zipBlob,
      zipFilename,
      pdfFilename,
      reportFilename,
      specFilename,
      copyableSpecText: specContent
    };
  }
}
