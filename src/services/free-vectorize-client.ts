import { AiVectorizer } from '../core/ai-vectorizer';
import { NetworkGuard } from './network-guard';

/**
 * 📐 Vectorizer Client (self-hosted VTracer / local Bézier splines fallback)
 *
 * Flow:
 * 1. Cache check (LRU)
 * 2. Privacy Shield check -> if active, run 100% local Bézier-spline tracer, skip the network entirely.
 * 3. Self-hosted VTracer Rust microservice (/api/vectorize — real, see docker/vtracer/).
 * 4. Fallback -> local AiVectorizer if the service is unreachable.
 */
export class FreeVectorizeClient {
  private static readonly cache = new Map<string, string>();

  /**
   * Helper to convert ImageData to PNG DataURL
   */
  private static imageDataToDataUrl(imageData: ImageData): string {
    if (typeof document === 'undefined') return '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
      }
    } catch {
      // ignore
    }
    return '';
  }

  /**
   * Convert raster image data to clean SVG paths, via self-hosted VTracer with local fallback
   */
  public static async vectorizeImage(
    imageData: ImageData,
    colorsCount: number = 12,
    smoothTolerance: number = 1.5
  ): Promise<{ svg: string; isCloud: boolean; engineName: string; elapsedMs?: number }> {
    const cacheKey = `${imageData.width}x${imageData.height}_colors_${colorsCount}_tol_${smoothTolerance}_${imageData.data[0]}_${imageData.data[10]}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return { svg: cached, isCloud: true, engineName: '快取向量引擎' };
    }

    // 1. Privacy Shield: skip the self-hosted service entirely, never send the image anywhere
    if (NetworkGuard.isPrivacyShieldActive()) {
      const svg = AiVectorizer.traceToSvg(imageData, colorsCount, smoothTolerance);
      return {
        svg,
        isCloud: false,
        engineName: '本機三次貝茲曲線引擎 (100% 本機模式)'
      };
    }

    const startMs = performance.now();

    // 2. Attempt self-hosted VTracer microservice
    try {
      const dataUrl = this.imageDataToDataUrl(imageData);
      if (dataUrl) {
        const response = await fetch('/api/vectorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDataUrl: dataUrl,
            colors: colorsCount,
            tolerance: smoothTolerance
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.svg) {
            const elapsed = Math.round(performance.now() - startMs);
            this.cache.set(cacheKey, result.svg);

            return {
              svg: result.svg,
              isCloud: true,
              engineName: '自建 VTracer 向量引擎',
              elapsedMs: result.elapsed_ms || elapsed
            };
          }
        }
      }
    } catch {
      // service unreachable, fall through to local
    }

    // 3. Fallback to local Bézier-spline engine
    const svg = AiVectorizer.traceToSvg(imageData, colorsCount, smoothTolerance);
    return {
      svg,
      isCloud: false,
      engineName: '本機三次貝茲曲線引擎 (Fallback)'
    };
  }

  /**
   * Clear in-memory cache
   */
  public static clearCache(): void {
    this.cache.clear();
  }
}


