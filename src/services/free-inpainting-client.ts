import { ObjectEraser } from '../core/object-eraser';
import { QuotaRouter } from './quota-router';
import { NetworkGuard } from './network-guard';

/**
 * 🎨 100% Self-Hosted & Local Multi-Engine Inpainting Client
 * Manages Self-Hosted LaMa / MAT Transformer, PatchMatch, and Local Navier-Stokes inpainting
 * 0 bytes sent to external cloud APIs.
 */
export class FreeInpaintingClient {
  private static readonly cache = new Map<string, ImageData>();

  /**
   * Erase unwanted objects/watermarks from image using mask with self-hosted container & local fallback
   */
  public static async eraseObject(
    sourceImageData: ImageData,
    maskImageData: ImageData
  ): Promise<{ imageData: ImageData; isCloud: boolean; modelUsed: string }> {
    const cacheKey = `${sourceImageData.width}x${sourceImageData.height}_${sourceImageData.data[0]}_${sourceImageData.data[100]}`;
    if (this.cache.has(cacheKey)) {
      return { imageData: this.cache.get(cacheKey)!, isCloud: true, modelUsed: 'Cached Inpainting' };
    }

    const bestProvider = QuotaRouter.getBestProvider('inpainting');

    // 1. If provider is local unlimited -> run local inpainter
    if (bestProvider.isLocalUnlimited) {
      const localResult = ObjectEraser.inpaint(sourceImageData, maskImageData);
      return {
        imageData: localResult,
        isCloud: false,
        modelUsed: '本機 Navier-Stokes 畫布修復'
      };
    }

    const startMs = performance.now();

    // 2. Attempt Self-Hosted Container Inpainting (LaMa / MAT on port 8082)
    try {
      const sourceDataUrl = this.imageDataToDataUrl(sourceImageData);
      const maskDataUrl = this.imageDataToDataUrl(maskImageData);

      const optimizedSource = await NetworkGuard.optimizePayloadForUpload(sourceDataUrl, 1024, 0.85);
      const optimizedMask = await NetworkGuard.optimizePayloadForUpload(maskDataUrl, 1024, 0.85);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('http://localhost:8082/inpaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: optimizedSource,
          mask_base64: optimizedMask
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.image_base64) {
          const resultImageData = await this.dataUrlToImageData(json.image_base64);
          QuotaRouter.recordUsage(bestProvider.id, Math.round(performance.now() - startMs));
          this.cache.set(cacheKey, resultImageData);

          return {
            imageData: resultImageData,
            isCloud: true,
            modelUsed: '自建 LaMa-Lite / MAT 神經網路修復'
          };
        }
      }
    } catch {
      // Container offline, fall back to local
    }

    // 3. Seamless Local Navier-Stokes Fallback
    const localResult = ObjectEraser.inpaint(sourceImageData, maskImageData);
    return {
      imageData: localResult,
      isCloud: false,
      modelUsed: '本機 Navier-Stokes 畫布修復 (自建備援)'
    };
  }

  private static imageDataToDataUrl(imageData: ImageData): string {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
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
