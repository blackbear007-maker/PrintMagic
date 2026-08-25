import { EdgeAwareUpscaler } from '../core/edge-aware-upscaler';
import { UnsharpMask } from '../core/unsharp-mask';

/**
 * Local Upscale Client
 *
 * There is no super-resolution model deployed anywhere in this stack (no RealESRGAN/HAT-S/SwinIR/
 * Waifu2x weights exist, self-hosted or otherwise). This always runs the local deterministic
 * EdgeAwareUpscaler (bilinear interpolation + edge boost — see src/core/edge-aware-upscaler.ts).
 * The three presets below only change the scale factor and sharpening amount, not the algorithm.
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
   * Upscales using the local edge-aware algorithm (with in-memory result caching)
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

      if (this.resultCache.size > 20) {
        const firstKey = this.resultCache.keys().next().value;
        if (firstKey) this.resultCache.delete(firstKey);
      }
      this.resultCache.set(cacheKey, {
        dataUrl: sourceDataUrl,
        imageData: healedImgData,
        model: config.name,
        scale: config.scale
      });

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
