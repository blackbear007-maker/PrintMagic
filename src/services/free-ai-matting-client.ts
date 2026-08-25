import { BiRefNetMatting } from '../core/birefnet-matting';
import { AiMatting } from '../core/ai-matting';
import { QuotaRouter } from './quota-router';
import { NetworkGuard } from './network-guard';

/**
 * ✂️ 100% Self-Hosted & Local BiRefNet-Lite Background Removal Client (MIT)
 * Connects directly to Self-Hosted Microservice (/api/ai/matting)
 * with automatic seamless offline fallback to client-side BiRefNet / AiMatting engine.
 * 0 bytes sent to external cloud APIs.
 */
export class FreeAiMattingClient {
  private static readonly cache = new Map<string, { dataUrl: string; imageData: ImageData }>();

  /**
   * Remove background using BiRefNet SOTA bilateral AI model with local fallback
   */
  public static async removeBackground(
    sourceDataUrl: string,
    sourceImageData: ImageData
  ): Promise<{ dataUrl: string; imageData: ImageData; isCloud: boolean }> {
    // 1. Check in-memory cache
    const cacheKey = sourceDataUrl.slice(0, 100) + `_matting_${sourceImageData.width}x${sourceImageData.height}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return { ...cached, isCloud: true };
    }

    const bestProvider = QuotaRouter.getBestProvider('matting');
    if (bestProvider.isLocalUnlimited) {
      const birefResult = BiRefNetMatting.extractMatting(sourceImageData, 0.5, true);
      const localResult = AiMatting.removeBackground(birefResult.mattedImageData, 28);
      return {
        dataUrl: localResult.dataUrl,
        imageData: birefResult.mattedImageData,
        isCloud: false
      };
    }

    const startMs = performance.now();

    // 2. Attempt Microservice call (/api/ai/matting)
    try {
      const compressedPayload = await NetworkGuard.optimizePayloadForUpload(sourceDataUrl, 1024, 0.82);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('/api/ai/matting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: compressedPayload
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.image_base64) {
          const resultImgData = await this.dataUrlToImageData(json.image_base64);
          QuotaRouter.recordUsage(bestProvider.id, Math.round(performance.now() - startMs));
          this.cache.set(cacheKey, { dataUrl: json.image_base64, imageData: resultImgData });

          return {
            dataUrl: json.image_base64,
            imageData: resultImgData,
            isCloud: true
          };
        }
      }
    } catch {
      // Microservice unavailable, proceed to local SOTA
    }

    // 3. Seamless Local BiRefNet-Lite Fallback
    const birefResult = BiRefNetMatting.extractMatting(sourceImageData, 0.5, true);
    const localResult = AiMatting.removeBackground(birefResult.mattedImageData, 28);
    return {
      dataUrl: localResult.dataUrl,
      imageData: birefResult.mattedImageData,
      isCloud: false
    };
  }

  private static async dataUrlToImageData(dataUrl: string): Promise<ImageData> {
    if (typeof document === 'undefined') {
      return { width: 100, height: 100, data: new Uint8ClampedArray(40000) } as ImageData;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context failure'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = () => reject(new Error('Image decode failure'));
      img.src = dataUrl;
    });
  }
}
