import { ContrastDehazeFilter } from '../core/contrast-dehaze-filter';
import { NetworkGuard } from './network-guard';

/**
 * Dehaze Client (self-hosted DehazeFormer-T / local scattering-inversion fallback)
 *
 * Flow, added 2026-08-26 (previously no dehaze feature was reachable from the UI at all —
 * ContrastDehazeFilter existed but nothing called it):
 * 1. Privacy Shield active -> skip the network entirely, run ContrastDehazeFilter locally (the
 *    classical dark-channel-prior-style scattering inversion — see its own honesty note).
 * 2. Otherwise, attempt the self-hosted DehazeFormer-T microservice (/api/ai/dehaze ->
 *    docker/zero-dce/, real trained MIT weights if manually sourced — see
 *    docker/zero-dce/weights/README.md; the service itself reports 503 honestly if the weight
 *    file wasn't provided at build time, which this client treats the same as "unreachable").
 * 3. Fallback -> local ContrastDehazeFilter if the service is unreachable, unavailable, or the
 *    result doesn't come back successfully.
 */
export interface DehazeResult {
  imageData: ImageData;
  isCloud: boolean;
  engine: string;
}

export class FreeDehazeClient {
  public static async dehaze(imageData: ImageData, strength: number = 0.75): Promise<DehazeResult> {
    if (!NetworkGuard.isPrivacyShieldActive()) {
      const cloudResult = await this.tryDehazeFormer(imageData);
      if (cloudResult) return cloudResult;
    }

    return {
      imageData: ContrastDehazeFilter.dehaze(imageData, strength),
      isCloud: false,
      engine: '本機大氣散射模型去霧 (Dark Channel Prior)'
    };
  }

  private static async tryDehazeFormer(imageData: ImageData): Promise<DehazeResult | null> {
    try {
      const dataUrl = this.imageDataToDataUrl(imageData);
      if (!dataUrl) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/ai/dehaze', {
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
        engine: 'DehazeFormer-T (自建服務)'
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
