import { store } from '../ui/state';
import { Toast } from '../ui/toast';
import { PdfExporter } from '../engines/pdf-exporter';
import type { PrintPreset } from '../types';

export interface CloudHealthResult {
  status: string;
  version: string;
  uptimeSeconds: number;
}

export interface CloudIccProfile {
  id: string;
  name: string;
  region: string;
  standard: string;
  maxTac: number;
  description: string;
}

export class CloudClient {
  private static baseUrl = 'http://localhost:3001/api';

  /**
   * Check if industrial cloud backend is alive
   */
  public static async checkHealth(): Promise<boolean> {
    try {
      store.setState({ cloudStatus: 'checking' });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        store.setState({ cloudStatus: 'online' });
        return true;
      }
      store.setState({ cloudStatus: 'offline' });
      return false;
    } catch {
      store.setState({ cloudStatus: 'offline' });
      return false;
    }
  }

  /**
   * Fetch supported ICC Profiles from Cloud or return local fallback list
   */
  public static async getIccProfiles(): Promise<CloudIccProfile[]> {
    try {
      const res = await fetch(`${this.baseUrl}/icc-profiles`);
      if (res.ok) {
        const json = await res.json();
        return json.profiles || [];
      }
    } catch {
      // Return local fallback
    }

    // ⚠️ 2026-08-29 修正：這裡原本只回傳 2 筆、id/數字跟前端 src/core/icc-profiles.ts 對不上
    // 的「離線備援清單」（fogra-39 這裡是 330%，前端是 300%）。改成與前端 4 個設定檔的
    // id／maxTac 完全一致，避免離線備援跟使用者實際會看到的選項互相矛盾。
    return [
      {
        id: 'japan-color-2001-coated',
        name: 'Japan Color 2001 Coated',
        region: '台灣 / 日本 合版印刷標準',
        standard: 'ISO 12647-2:2001',
        maxTac: 350,
        description: '台灣合版印刷界最普遍採用之色彩標準，顯色鮮豔飽和，適用高彩度商業印件。'
      },
      {
        id: 'iso-coated-v2-fogra39',
        name: 'ISO Coated v2 (ECI) / FOGRA39',
        region: '歐洲商業印刷與精裝藝術畫冊規範',
        standard: 'ISO 12647-2:2004',
        maxTac: 300,
        description: '歐洲 ISO 12647-2 國際印刷標準，嚴格限制總墨量 ≤300%，階調平衡平穩細緻。'
      },
      {
        id: 'gracol-2006-coated',
        name: 'GRACoL 2006 Coated1v2',
        region: '北美商業平版印刷標準 (IDEAlliance G7 校正)',
        standard: 'IDEAlliance GRACoL2006_Coated1v2',
        maxTac: 320,
        description: '美洲外銷印件通用之 G7 灰色平衡印刷標準，階調高反差、色彩亮麗。'
      },
      {
        id: 'japan-color-2001-uncoated',
        name: 'Japan Color 2001 Uncoated',
        region: '非塗布紙 / 吸墨紙專用標準',
        standard: 'ISO 12647-2:2001 (Uncoated)',
        maxTac: 260,
        description: '針對吸墨量大、無塗布之美術紙設計，網點擴大率補償達 22%，防止深色死黑黏結。'
      }
    ];
  }

  /**
   * Export Industrial PDF/X-1a with automatic local fallback
   */
  public static async exportPdfx(
    imageDataUrl: string,
    preset: PrintPreset,
    artworkName = 'Artwork',
    iccProfileId = 'japan-color-2001-coated'
  ): Promise<void> {
    const isOnline = store.getState().cloudStatus === 'online' || (await this.checkHealth());

    if (isOnline) {
      try {
        Toast.info('⚡ 正在連線自建引擎生成印前工業 PDF (含出血、裁切線與內容雜湊)...');

        const res = await fetch(`${this.baseUrl}/export-pdfx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDataUrl,
            preset,
            artworkName,
            iccProfileId,
            pdfStandard: 'PDF/X-1a:2001'
          })
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const checksum = res.headers.get('X-PrintMagic-Checksum') || 'VERIFIED';
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PrintMagic_${artworkName}_PDFX_1a.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        Toast.success(`✓ 印前工業 PDF 已輸出！(內容 SHA-256: ${checksum.slice(0, 12)}…)`);
        return;
      } catch (err) {
        console.warn('Cloud export failed, automatically falling back to client-side engine:', err);
        Toast.info('⚠️ 雲端引擎暫時無回應，已自動無縫降級為本機引擎匯出...');
      }
    } else {
      Toast.info('💡 目前處於本機離線模式，使用本機引擎輸出標準印刷 PDF...');
    }

    // Client-side fallback
    await PdfExporter.export(
      imageDataUrl,
      preset,
      `PrintMagic_${artworkName}_Local_${Date.now()}.pdf`,
      store.getState().cropAnchor
    );
    Toast.success('✓ 本機標準印刷 PDF 已順利輸出！');
  }
}
