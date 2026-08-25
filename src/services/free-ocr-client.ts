import { NetworkGuard } from './network-guard';

/**
 * Self-Hosted OCR Client
 *
 * Calls the real self-hosted Tesseract OCR service (/api/ocr → docker/tesseract/) — genuine text
 * recognition, not a "PP-OCR" model (no such model is deployed anywhere in this stack). If the
 * service is unreachable, this returns an empty token list rather than a fake offline result:
 * there is no local text-recognition fallback, because recognizing characters from pixels isn't
 * something a hand-written heuristic can do. (src/core/text-zone-detector.ts exists separately as
 * an offline "does this artwork have small/illegible text zones" pre-flight check — it flags
 * regions, it does not read them.)
 *
 * Per-word `confidence` and `bbox` below are synthesized (Tesseract's plain-text output mode does
 * not return per-word coordinates or confidence) — the recognized `text` itself is real, but treat
 * the position/confidence numbers as a rough layout approximation, not measured values.
 */
export interface OcrToken {
  text: string;
  confidence: number;
  bbox: {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
  fontSizePx: number;
}

export class FreeOcrClient {
  private static readonly cache = new Map<string, { tokens: OcrToken[]; engine: string }>();

  public static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Scan and extract structured text layers with 100% private self-hosted routing
   */
  public static async extractTextLayers(
    imageDataUrl: string,
    width: number,
    height: number
  ): Promise<{ tokens: OcrToken[]; isCloud: boolean; engineName?: string }> {
    const cacheKey = imageDataUrl.slice(0, 100) + `_ocr_${width}x${height}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return { tokens: cached.tokens, isCloud: true, engineName: `快取 [${cached.engine}]` };
    }

    // Privacy Shield: skip the self-hosted service entirely, never send the image anywhere
    if (NetworkGuard.isPrivacyShieldActive()) {
      return { tokens: [], isCloud: false, engineName: '100% 本機模式（文字辨識未執行，僅本機標示可能的文字區塊）' };
    }

    // 1. Self-hosted Tesseract OCR (/api/ocr — real, see docker/tesseract/)
    const ocrResult = await this.trySelfHostedOcr(imageDataUrl);
    if (ocrResult) {
      this.cache.set(cacheKey, { tokens: ocrResult.tokens, engine: '自建 Tesseract OCR' });
      return {
        tokens: ocrResult.tokens,
        isCloud: true,
        engineName: '自建 Tesseract OCR 微服務'
      };
    }

    // 2. Service unreachable — there is no local text-recognition fallback (see class doc comment)
    return { tokens: [], isCloud: false, engineName: '自建 OCR 服務離線，未執行文字辨識' };
  }

  /**
   * Calls the self-hosted Tesseract OCR service via backend /api/ocr
   */
  private static async trySelfHostedOcr(
    imageDataUrl: string
  ): Promise<{ tokens: OcrToken[] } | null> {
    try {
      const optimizedUrl = await NetworkGuard.optimizePayloadForUpload(imageDataUrl, 1280, 0.85);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: optimizedUrl,
          lang: 'chi_tra+eng'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.text) {
          // `text` is real (from Tesseract). Position/confidence below are NOT — Tesseract's
          // plain-text mode gives us none of that, so this lays words out on a synthetic grid
          // rather than their real coordinates. Good enough for a "here's roughly where text is"
          // overlay; do not treat these numbers as measured.
          const words = result.text.split(/\s+/).filter((w: string) => w.length > 0);
          const tokens: OcrToken[] = words.map((w: string, idx: number) => ({
            text: w,
            confidence: 0.98, // placeholder — engine does not report per-word confidence
            bbox: {
              xPercent: Math.min(90, Math.max(5, (idx % 4) * 22 + 5)),
              yPercent: Math.min(90, Math.max(5, Math.floor(idx / 4) * 15 + 10)),
              widthPercent: Math.min(40, Math.max(10, w.length * 6)),
              heightPercent: 8
            },
            fontSizePx: 24
          }));

          return { tokens };
        }
      }
    } catch {
      // service offline
    }
    return null;
  }
}
