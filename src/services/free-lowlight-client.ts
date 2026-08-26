import { ZeroDceEnhancer } from '../core/zero-dce-enhancer';
import { NetworkGuard } from './network-guard';

/**
 * Low-Light Enhancement Client (self-hosted Retinexformer / local curve-estimation fallback)
 *
 * Flow, added 2026-08-26 (previously reachable through /api/ai/lowlight only, which was dead
 * code — nothing in the frontend called it; the pipeline only ever used the local
 * ZeroDceEnhancer directly):
 * 1. Privacy Shield active -> skip the network entirely, run ZeroDceEnhancer locally (a hand-
 *    tuned iterative curve heuristic — see its own honesty note, it is not a trained model).
 * 2. Otherwise, attempt the self-hosted Retinexformer microservice (/api/ai/lowlight ->
 *    docker/zero-dce/, real trained MIT weights if manually sourced — see
 *    docker/zero-dce/weights/README.md; the service itself reports 503 honestly if the weight
 *    file wasn't provided at build time, which this client treats the same as "unreachable").
 * 3. Fallback -> local ZeroDceEnhancer if the service is unreachable, unavailable, or the result
 *    doesn't come back successfully.
 */
export interface LowLightResult {
  imageData: ImageData;
  isCloud: boolean;
  engine: string;
}

export class FreeLowlightClient {
  public static async enhance(imageData: ImageData): Promise<LowLightResult> {
    if (!NetworkGuard.isPrivacyShieldActive()) {
      const cloudResult = await this.tryRetinexformer(imageData);
      if (cloudResult) return cloudResult;
    }

    const local = ZeroDceEnhancer.enhance(imageData, 2, 0.5);
    return {
      imageData: local.enhancedImageData,
      isCloud: false,
      engine: '本機曲線估計提亮 (Fallback)'
    };
  }

  private static async tryRetinexformer(imageData: ImageData): Promise<LowLightResult | null> {
    try {
      const dataUrl = this.imageDataToDataUrl(imageData);
      if (!dataUrl) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/ai/lowlight', {
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
        isCloud: true,
        engine: 'Retinexformer (自建服務)'
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
