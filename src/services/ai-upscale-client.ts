/**
 * Multi-Model Free AI Super-Resolution Client (Smart Hybrid Engine)
 * Interacts with Hugging Face Serverless & Gradio Spaces:
 * 1. Real-ESRGAN 4x+ (General Photo / Digital Art)
 * 2. Real-ESRGAN Anime6B (Anime / Manga Lineart / Stickers)
 * 3. Waifu2x (Clean 2D Denoise & Vector Lineart)
 */

export type AiModelType = 'real-esrgan-general' | 'real-esrgan-anime' | 'waifu2x';

export interface AiModelConfig {
  id: AiModelType;
  name: string;
  desc: string;
  hfModel: string;
  gradioSpaceUrl?: string;
  scale: number;
}

export const AI_MODELS: AiModelConfig[] = [
  {
    id: 'real-esrgan-general',
    name: 'Real-ESRGAN 4x+ 通用高清',
    desc: '適合真實攝影照片、人像、3D CG 與商業產品圖',
    hfModel: 'ai-forever/Real-ESRGAN',
    gradioSpaceUrl: 'https://akhaliq-real-esrgan.hf.space/api/predict',
    scale: 4
  },
  {
    id: 'real-esrgan-anime',
    name: 'Real-ESRGAN Anime6B 動漫專用',
    desc: '適合日系二次元插畫、同人周邊、模切貼紙與向量線條',
    hfModel: 'xinntao/Real-ESRGAN-anime',
    gradioSpaceUrl: 'https://akhaliq-real-esrgan.hf.space/api/predict',
    scale: 4
  },
  {
    id: 'waifu2x-cupcake',
    name: 'Waifu2x 極致降噪插畫',
    desc: '專注消除 JPEG 區塊假影並強化輪廓平滑度',
    hfModel: 'hakurei/waifu2x',
    gradioSpaceUrl: 'https://hakurei-waifu2x.hf.space/api/predict',
    scale: 2
  } as any
];

export interface AiUpscaleResult {
  success: boolean;
  dataUrl?: string;
  imageData?: ImageData;
  model?: string;
  scale?: number;
  error?: string;
  fallbackToLocal?: boolean;
}

export class AiUpscaleClient {
  private static readonly BACKEND_URL = 'http://localhost:3001/api/ai-upscale';

  public static getStoredToken(): string {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('printmagic_hf_token') || '';
    }
    return '';
  }

  public static setStoredToken(token: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('printmagic_hf_token', token.trim());
    }
  }

  public static getStoredModel(): AiModelType {
    if (typeof localStorage !== 'undefined') {
      const m = localStorage.getItem('printmagic_ai_model') as AiModelType;
      if (m && AI_MODELS.some((item) => item.id === m)) return m;
    }
    return 'real-esrgan-general';
  }

  public static setStoredModel(model: AiModelType): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('printmagic_ai_model', model);
    }
  }

  /**
   * Calls AI Neural Upscaler with multi-tier fallback
   */
  public static async upscale(
    sourceDataUrl: string,
    modelId: AiModelType = this.getStoredModel(),
    customToken: string = this.getStoredToken()
  ): Promise<AiUpscaleResult> {
    const config = AI_MODELS.find((m) => m.id === modelId) || AI_MODELS[0];

    // 1. Tier 1: Local Backend Proxy
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const res = await fetch(this.BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: sourceDataUrl,
          apiKey: customToken || undefined,
          model: config.hfModel
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.dataUrl) {
          const imgData = await this.dataUrlToImageData(data.dataUrl);
          return {
            success: true,
            dataUrl: data.dataUrl,
            imageData: imgData,
            model: data.model || config.name,
            scale: config.scale
          };
        }
      }
    } catch {
      // Proxy unavailable, proceed to Tier 2
    }

    // 2. Tier 2: Direct Serverless REST Inference
    try {
      const base64Data = sourceDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream'
      };
      if (customToken) headers['Authorization'] = `Bearer ${customToken}`;

      const directUrl = `https://api-inference.huggingface.co/models/${config.hfModel}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(directUrl, {
        method: 'POST',
        headers,
        body: byteArray,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const blob = await res.blob();
        const dataUrl = await this.blobToDataUrl(blob);
        const imgData = await this.dataUrlToImageData(dataUrl);

        return {
          success: true,
          dataUrl,
          imageData: imgData,
          model: `${config.name} (Direct Cloud)`,
          scale: config.scale
        };
      }
    } catch {
      // Direct inference failed, proceed to Tier 3 Gradio Space
    }

    // 3. Tier 3: Gradio Free Space API Fallback
    if (config.gradioSpaceUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(config.gradioSpaceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [sourceDataUrl] }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data[0]) {
            const dataUrl = json.data[0];
            const imgData = await this.dataUrlToImageData(dataUrl);
            return {
              success: true,
              dataUrl,
              imageData: imgData,
              model: `${config.name} (Gradio Free Space)`,
              scale: config.scale
            };
          }
        }
      } catch {
        // Gradio space busy or offline
      }
    }

    // 4. Tier 4: Graceful Automatic Local Fallback
    return {
      success: false,
      fallbackToLocal: true,
      error: 'AI 雲端伺服器離線或佇列中，自動無縫啟用本機 8x 金字塔超解析度引擎'
    };
  }

  private static dataUrlToImageData(dataUrl: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = () => reject(new Error('Failed to decode image data URL'));
      img.src = dataUrl;
    });
  }

  private static blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
