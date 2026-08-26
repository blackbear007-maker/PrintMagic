import { EdgeAwareUpscaler } from '../core/edge-aware-upscaler';
import { UnsharpMask } from '../core/unsharp-mask';
import { NetworkGuard } from './network-guard';

/**
 * Upscale Client (self-hosted Real-ESRGAN / local edge-aware fallback)
 *
 * Flow, added 2026-08-26 (previously 100% local — no super-resolution model existed anywhere in
 * this stack):
 * 1. Privacy Shield active -> skip the network entirely, run the local deterministic
 *    EdgeAwareUpscaler (bilinear interpolation + edge boost — see src/core/edge-aware-upscaler.ts).
 * 2. Otherwise, attempt the self-hosted Real-ESRGAN compact (x4v3) microservice (/api/ai/upscale
 *    -> docker/zero-dce/, real trained BSD-3-Clause weights). The service caps input at ~1.44MP
 *    (measured: larger inputs cost too much container RAM even with tiling — see
 *    docker/zero-dce/server.py), so the payload is downscaled to fit before sending.
 * 3. Fallback -> local EdgeAwareUpscaler if the service is unreachable, unavailable, or the
 *    result doesn't come back successfully. The three presets below only change the local
 *    fallback's scale factor and sharpening amount, not which algorithm runs — they're not
 *    different models.
 */

export type AiModelType = 'general-4x' | 'lineart-4x' | 'fast-2x';

export interface AiModelConfig {
  id: AiModelType;
  name: string;
  desc: string;
  scale: 2 | 4;
  denoiseStrength: number;
}

export const AI_MODELS: AiModelConfig[] = [
  {
    id: 'general-4x',
    name: '4x 通用放大',
    desc: '適合真實攝影照片、人像、3D CG、商業海報與包裝圖檔',
    scale: 4,
    denoiseStrength: 0.6
  },
  {
    id: 'lineart-4x',
    name: '4x 線條強化放大',
    desc: '適合日系二次元插畫、同人周邊、模切貼紙與向量線條，邊緣加強較多',
    scale: 4,
    denoiseStrength: 0.4
  },
  {
    id: 'fast-2x',
    name: '2x 快速放大',
    desc: '較小放大倍率，處理更快，適合預覽或已經高解析度的圖檔',
    scale: 2,
    denoiseStrength: 0.6
  }
];

export interface AiUpscaleResult {
  success: boolean;
  dataUrl?: string;
  imageData?: ImageData;
  model?: string;
  scale?: number;
  cached?: boolean;
  error?: string;
}

export class AiUpscaleClient {
  // Fast in-memory LRU Cache (max 20 processed images)
  private static readonly resultCache = new Map<string, { dataUrl: string; imageData: ImageData; model: string; scale: number }>();

  public static getStoredModel(): AiModelType {
    if (typeof localStorage !== 'undefined') {
      const m = localStorage.getItem('printmagic_ai_model') as AiModelType;
      if (m && AI_MODELS.some((item) => item.id === m)) return m;
    }
    return 'general-4x';
  }

  public static setStoredModel(model: AiModelType): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('printmagic_ai_model', model);
    }
  }

  /**
   * Fast non-cryptographic hash for payload caching
   */
  private static computeHash(str: string, modelId: string): string {
    let hash = 5381;
    const len = Math.min(str.length, 10000); // sample first 10k chars for speed
    for (let i = 0; i < len; i += 16) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `${modelId}_${str.length}_${hash}`;
  }

  /**
   * Compresses source dataUrl to efficient lightweight JPEG/WebP for ultra-fast processing
   */
  public static async compressPayloadForUpload(sourceDataUrl: string, maxDimension: number = 1600): Promise<string> {
    if (typeof document === 'undefined') return sourceDataUrl;

    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = sourceDataUrl;
      });

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      if (w <= maxDimension && h <= maxDimension && sourceDataUrl.length < 1000000) {
        return sourceDataUrl;
      }

      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return sourceDataUrl;

      ctx.drawImage(img, 0, 0, targetW, targetH);
      return canvas.toDataURL('image/webp', 0.95);
    } catch {
      return sourceDataUrl;
    }
  }

  /**
   * Upscales via self-hosted Real-ESRGAN (with local edge-aware fallback and in-memory result
   * caching). See the class-level honesty note for the full flow.
   */
  public static async upscale(
    sourceDataUrl: string,
    modelId: AiModelType = this.getStoredModel()
  ): Promise<AiUpscaleResult> {
    const config = AI_MODELS.find((m) => m.id === modelId) || AI_MODELS[0];

    const cacheKey = this.computeHash(sourceDataUrl, config.id);
    if (this.resultCache.has(cacheKey)) {
      const cached = this.resultCache.get(cacheKey)!;
      return {
        success: true,
        dataUrl: cached.dataUrl,
        imageData: cached.imageData,
        model: cached.model,
        scale: cached.scale,
        cached: true
      };
    }

    if (!NetworkGuard.isPrivacyShieldActive()) {
      const cloudResult = await this.tryRealEsrgan(sourceDataUrl);
      if (cloudResult) {
        this.cacheResult(cacheKey, cloudResult);
        return cloudResult;
      }
    }

    try {
      const simImgData = await this.dataUrlToImageData(sourceDataUrl);
      const upscaleRes = EdgeAwareUpscaler.upscale(simImgData, config.scale, config.denoiseStrength);
      const healedImgData = UnsharpMask.apply(upscaleRes.upscaledImageData, 1.3, 0.9, 3);

      const result: AiUpscaleResult = {
        success: true,
        dataUrl: sourceDataUrl,
        imageData: healedImgData,
        model: config.name,
        scale: config.scale
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (err: any) {
      return {
        success: false,
        model: config.name,
        scale: config.scale,
        error: err?.message || 'Local upscale failed'
      };
    }
  }

  /**
   * Attempts the self-hosted Real-ESRGAN microservice. Returns null (not a failed AiUpscaleResult)
   * on any failure so callers fall through to the local path — that distinction matters here
   * because "the service said no" and "the service is unreachable" should both just mean
   * "use the local fallback," not "report failure to the user."
   */
  private static async tryRealEsrgan(sourceDataUrl: string): Promise<AiUpscaleResult | null> {
    try {
      // Server caps input at ~1.44MP (measured RAM cost, see docker/zero-dce/server.py) — shrink
      // to fit before sending rather than let the request get rejected.
      const payload = await this.compressPayloadForUpload(sourceDataUrl, 1200);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch('/api/ai/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: payload }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success || !data.dataUrl) return null;

      const imageData = await this.dataUrlToImageData(data.dataUrl);
      return {
        success: true,
        dataUrl: data.dataUrl,
        imageData,
        model: 'Real-ESRGAN compact x4v3 (自建服務)',
        scale: 4
      };
    } catch {
      return null;
    }
  }

  private static cacheResult(
    cacheKey: string,
    result: AiUpscaleResult
  ): void {
    if (!result.imageData || !result.dataUrl || !result.model || !result.scale) return;
    if (this.resultCache.size > 20) {
      const firstKey = this.resultCache.keys().next().value;
      if (firstKey) this.resultCache.delete(firstKey);
    }
    this.resultCache.set(cacheKey, {
      dataUrl: result.dataUrl,
      imageData: result.imageData,
      model: result.model,
      scale: result.scale
    });
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
