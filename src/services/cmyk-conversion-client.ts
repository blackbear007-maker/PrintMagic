import { NetworkGuard } from './network-guard';
import type { CmykRaster } from '../engines/cmyk-pdf-writer';

export type CmykConversionResult =
  | { ok: true; raster: CmykRaster }
  | { ok: false; reason: string };

/**
 * Print CMYK separation client (2026-09-25).
 *
 * Sends the finished print image (PNG, as the pipeline produced it) to the self-hosted separation
 * service — POST /api/ai/cmyk -> docker/zero-dce/cmyk_convert.py, a real ICC transform (LittleCMS)
 * with the Adobe press profile matching the app's colour-profile menu. Binary in both directions:
 * the response body is already a PDF /FlateDecode stream of CMYK samples for CmykPdfWriter.
 *
 * No local fallback for the separation itself: CmykEngine's formula has no press characterization
 * behind it, and a wrong separation the print shop then prints as-is is worse than an RGB file they
 * convert themselves. When this returns ok:false the caller exports the RGB PDF and says so.
 */
export class CmykConversionClient {
  public static async convert(imageDataUrl: string, profileId: string): Promise<CmykConversionResult> {
    if (!NetworkGuard.isRemoteAllowed()) {
      return { ok: false, reason: '本機模式不上傳圖片，CMYK 分色需要雲端服務' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const png = await (await fetch(imageDataUrl)).blob();
      const res = await fetch(`/api/ai/cmyk?profile=${encodeURIComponent(profileId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: png,
        signal: controller.signal
      });
      const infoHeader = res.headers.get('X-Cmyk-Info');
      if (!res.ok || !infoHeader) {
        const body = await res.json().catch(() => undefined);
        return { ok: false, reason: body?.error || `分色服務回應 ${res.status}` };
      }
      const info = JSON.parse(infoHeader);
      const flateData = new Uint8Array(await res.arrayBuffer());
      if (!(info.width > 0 && info.height > 0 && flateData.length > 0)) {
        return { ok: false, reason: '分色服務回傳的資料不完整' };
      }
      return {
        ok: true,
        raster: {
          width: info.width,
          height: info.height,
          flateData,
          profileId: info.profileId,
          outputConditionIdentifier: info.outputConditionIdentifier,
          outputCondition: info.outputCondition,
          tacMaxPercent: info.tacMaxPercent,
          tacMeanPercent: info.tacMeanPercent
        }
      };
    } catch (err: any) {
      return { ok: false, reason: err?.name === 'AbortError' ? '分色服務逾時' : `分色服務無法連線：${err?.message || err}` };
    } finally {
      clearTimeout(timer);
    }
  }
}
