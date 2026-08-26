import { ObjectEraser } from '../core/object-eraser';
import { NetworkGuard } from './network-guard';

/**
 * 🎨 Inpainting Client (self-hosted LaMa / local Navier-Stokes fallback)
 *
 * Flow, added 2026-08-26 (previously: "there is no self-hosted inpainting model — an earlier
 * version tried POSTing to a `/inpaint` endpoint that returned the input image unchanged while
 * reporting success, see the git history of docker/zero-dce/server.py — this always ran the real
 * local engine directly"):
 * 1. Privacy Shield active -> skip the network entirely, run ObjectEraser locally (a Navier-
 *    Stokes style canvas inpainter — see src/core/object-eraser.ts).
 * 2. Otherwise, attempt the self-hosted LaMa microservice (/api/ai/inpaint -> docker/zero-dce/,
 *    real trained Apache-2.0 weights, auto-downloaded at Docker build time — verified 2026-08-26
 *    by actually downloading a real copy and confirming it cleanly removes a solid-color test
 *    "watermark" region).
 * 3. Fallback -> local ObjectEraser if the service is unreachable, unavailable, or the result
 *    doesn't come back successfully.
 */
export class FreeInpaintingClient {
  private static readonly cache = new Map<string, ImageData>();

  /**
   * Erase unwanted objects/watermarks from image using mask
   */
  public static async eraseObject(
    sourceImageData: ImageData,
    maskImageData: ImageData
  ): Promise<{ imageData: ImageData; isCloud: boolean; modelUsed: string }> {
    const cacheKey = `${sourceImageData.width}x${sourceImageData.height}_${sourceImageData.data[0]}_${sourceImageData.data[100]}`;
    if (this.cache.has(cacheKey)) {
      return { imageData: this.cache.get(cacheKey)!, isCloud: false, modelUsed: '快取結果' };
    }

    if (!NetworkGuard.isPrivacyShieldActive()) {
      const cloudResult = await this.tryLama(sourceImageData, maskImageData);
      if (cloudResult) {
        this.cache.set(cacheKey, cloudResult.imageData);
        return cloudResult;
      }
    }

    const localResult = ObjectEraser.inpaint(sourceImageData, maskImageData);
    this.cache.set(cacheKey, localResult);
    return {
      imageData: localResult,
      isCloud: false,
      modelUsed: '本機 Navier-Stokes 畫布修復'
    };
  }

  private static async tryLama(
    sourceImageData: ImageData,
    maskImageData: ImageData
  ): Promise<{ imageData: ImageData; isCloud: boolean; modelUsed: string } | null> {
    try {
      const imageDataUrl = this.imageDataToDataUrl(sourceImageData);
      const maskDataUrl = this.imageDataToDataUrl(maskImageData);
      if (!imageDataUrl || !maskDataUrl) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch('/api/ai/inpaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageDataUrl, mask_base64: maskDataUrl }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success || !data.dataUrl) return null;

      const resultImageData = await this.dataUrlToImageData(data.dataUrl);
      return { imageData: resultImageData, isCloud: true, modelUsed: 'LaMa (自建服務)' };
    } catch {
      return null;
    }
  }

  private static imageDataToDataUrl(imageData: ImageData): string {
    if (typeof document === 'undefined') return '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }

  private static async dataUrlToImageData(dataUrl: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context creation failed'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = () => reject(new Error('Failed to decode image data URL'));
      img.src = dataUrl;
    });
  }
}
