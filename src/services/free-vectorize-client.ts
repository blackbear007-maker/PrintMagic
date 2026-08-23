import { AiVectorizer } from '../core/ai-vectorizer';
import { QuotaRouter } from './quota-router';
import { NetworkGuard } from './network-guard';

/**
 * 📐 Free Multi-Engine Vectorizer Client (VTracer Rust / Local Bézier Splines)
 * 
 * Flow:
 * 1. Cache Check (LRU)
 * 2. Privacy Shield Check -> If active, execute 100% offline local Catmull-Rom/Bézier Splines.
 * 3. VTracer Rust Microservice -> High-speed multi-color polygon tracing with curve fitting.
 * 4. Fallback -> Local AiVectorizer (zero dependencies, works everywhere).
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
   * Convert raster image data to clean SVG paths with dynamic quota routing & local fallback
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

    // 1. Privacy Shield Check
    if (NetworkGuard.isPrivacyShieldActive()) {
      const svg = AiVectorizer.traceToSvg(imageData, colorsCount, smoothTolerance);
      return {
        svg,
        isCloud: false,
        engineName: '本機三次貝茲曲線引擎 (100% 離線隱私模式)'
      };
    }

    const bestProvider = QuotaRouter.getBestProvider('vectorize');

    // 2. If provider is set to local unlimited -> execute Local Engine
    if (bestProvider.isLocalUnlimited) {
      const svg = AiVectorizer.traceToSvg(imageData, colorsCount, smoothTolerance);
      return {
        svg,
        isCloud: false,
        engineName: '本機三次貝茲曲線引擎'
      };
    }

    const startMs = performance.now();

    // 3. Attempt VTracer Rust Cloud / Local Microservice Inference
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
            QuotaRouter.recordUsage(bestProvider.id, elapsed);
            this.cache.set(cacheKey, result.svg);

            return {
              svg: result.svg,
              isCloud: true,
              engineName: 'VTracer Rust 極速向量引擎 (微服務)',
              elapsedMs: result.elapsed_ms || elapsed
            };
          }
        }
      }
    } catch {
      QuotaRouter.recordFailure(bestProvider.id, false);
    }

    // 4. Fallback to Local Bézier Spline Engine
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


