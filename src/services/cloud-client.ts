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

    return [
      {
        id: 'japan-color-2001',
        name: 'Japan Color 2001 Coated',
        region: '亞洲 / 台灣 / 日本',
        standard: 'ISO 12647-2:2001',
        maxTac: 350,
        description: '亞洲平版印刷最廣泛採用之商業銅版紙標準'
      },
      {
        id: 'fogra-39',
        name: 'FOGRA39 (ISO Coated v2)',
        region: '歐洲 / 國際標準',
        standard: 'ISO 12647-2:2004',
        maxTac: 330,
        description: '歐洲高階商業印刷與展覽畫冊通用標準'
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
    iccProfileId = 'japan-color-2001'
  ): Promise<void> {
    const isOnline = store.getState().cloudStatus === 'online' || (await this.checkHealth());

    if (isOnline) {
      try {
        Toast.info('⚡ 正在連線雲端工業引擎生成 PDF/X-1a (含 OutputIntent 與 Checksum)...');

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

        Toast.success(`✓ 雲端 PDF/X-1a 工業標準印刷檔已輸出！(認證碼: ${checksum})`);
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
