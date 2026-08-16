/**
 * Free AI Super-Resolution Client (Smart Hybrid Engine)
 * Interacts with Hugging Face Serverless Real-ESRGAN / Local Proxy with automatic fallback
 */

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
  private static readonly DIRECT_HF_URL =
    'https://api-inference.huggingface.co/models/ai-forever/Real-ESRGAN';

  /**
   * Calls AI Neural Upscaler with 100% graceful fallback to local Lanczos-3
   */
  public static async upscale(
    sourceDataUrl: string,
    apiKey?: string
  ): Promise<AiUpscaleResult> {
    // 1. First attempt: Try Local Backend Server Proxy
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const res = await fetch(this.BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: sourceDataUrl, apiKey }),
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
            model: data.model || 'Real-ESRGAN 4x+ (Deep Learning)',
            scale: 4
          };
        }
      }
    } catch (e) {
      // Backend not running or timed out, attempt direct cloud fallback
    }

    // 2. Second attempt: Direct Client-Side Free Inference
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
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(this.DIRECT_HF_URL, {
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
          model: 'Real-ESRGAN 4x+ (Direct Cloud)',
          scale: 4
        };
      }
    } catch (e) {
      // Direct cloud failed or rate-limited
    }

    // 3. Graceful Fallback indicator
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
