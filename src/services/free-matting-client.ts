import { AiMatting } from '../core/ai-matting';
import { NetworkGuard } from './network-guard';

/**
 * Background Removal / Matting Client (self-hosted rembg/u2netp / local color-key fallback)
 *
 * Flow, added 2026-08-27:
 * 1. Privacy Shield active -> skip the network entirely, run AiMatting locally (corner-sampled
 *    color-distance matting — only works reliably on a flat, uniform background; see its own
 *    honesty note, it is not a neural network).
 * 2. Otherwise, attempt the self-hosted rembg microservice (/api/ai/matting -> docker/zero-dce/,
 *    real trained MIT weights, u2netp session specifically — never rembg's own default session,
 *    which can resolve to a non-commercial model). Verified 2026-08-27: correctly separated a
 *    solid test subject from a textured, non-uniform gradient+noise background — exactly the
 *    case AiMatting's flat-background assumption cannot handle.
 * 3. Fallback -> local AiMatting if the service is unreachable, unavailable, or the result
 *    doesn't come back successfully.
 */
export interface MattingResult {
  imageData: ImageData;
  dataUrl: string;
  isCloud: boolean;
  engine: string;
}

export class FreeMattingClient {
  public static async removeBackground(imageData: ImageData): Promise<MattingResult> {
    if (!NetworkGuard.isPrivacyShieldActive()) {
      const cloudResult = await this.tryRembg(imageData);
      if (cloudResult) return cloudResult;
    }

    const local = AiMatting.removeBackground(imageData);
    return {
      imageData: local.imageData,
      dataUrl: local.dataUrl,
      isCloud: false,
      engine: '本機顏色距離去背 (Fallback)'
    };
  }

  private static async tryRembg(imageData: ImageData): Promise<MattingResult | null> {
    try {
      const dataUrl = this.imageDataToDataUrl(imageData);
      if (!dataUrl) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/ai/matting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: dataUrl }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success || !data.dataUrl) return null;

      const resultImageData = await this.dataUrlToImageData(data.dataUrl);
      return {
        imageData: resultImageData,
        dataUrl: data.dataUrl,
        isCloud: true,
        engine: 'rembg u2netp (自建服務)'
      };
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
