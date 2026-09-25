/**
 * 🛡️ NetworkGuard — Upload Payload Helpers
 *
 * 2026-09-20 簡化：原本這裡還有一個獨立的「Privacy Shield」開關，可以在雲端模式下額外強制只用
 * 本機演算法。使用者指出這多此一舉——本機模式（engineMode === 'local'）本身就已經是 100% 隱私
 * 模式，不會有任何圖片離開瀏覽器；如果使用者不想上傳圖片，切回本機模式就好，不需要在雲端模式裡
 * 再疊加一個「其實我不想要雲端」的開關。已整個移除，`isRemoteAllowed()` 現在單純只看 engineMode。
 *
 * 自建服務（VTracer，以及 PyTorch 視覺服務容器的 Retinexformer/Real-ESRGAN/LaMa/rembg/YuNet，
 * 皆掛在 `/api/*`）只在 engineMode === 'cloud' 時才會被嘗試呼叫；本機模式下一律使用
 * src/core/ 裡的本機決定性演算法，圖片不會離開瀏覽器。沒有涉及任何第三方雲端 API——
 * 「自建」指的是你（或這個部署的維運者）自己架設的伺服器，不是外部供應商。
 */
import { store } from '../ui/state';

/** 'vision' = the zero-dce container behind /api/ai/*; 'vectorize' = vtracer behind /api/vectorize. */
export type RemoteService = 'vision' | 'vectorize';

export class NetworkGuard {
  private static healthCheck: Promise<boolean> | null = null;

  /**
   * Single gate for every client that would send user image data to a self-hosted `/api/*`
   * service. False in 本機基本功能 (engineMode === 'local') — callers must use their local
   * fallback and never upload. In 雲端高階功能 it is also false for a service the last /api/health
   * probe reported down (2026-09-26): the image goes straight to the local algorithm instead of
   * being uploaded to a dead service and falling back after the error. Not probed yet = try it.
   */
  public static isRemoteAllowed(service: RemoteService = 'vision'): boolean {
    try {
      const state = store.getState();
      return state.engineMode === 'cloud' && state.remoteServices?.[service] !== false;
    } catch {
      return false;
    }
  }

  /**
   * GET /api/health and record which services answered (cloudStatus is 'online' when the site
   * backend and the vision service both do). Concurrent callers share one request.
   */
  public static checkHealth(): Promise<boolean> {
    if (this.healthCheck) return this.healthCheck;
    this.healthCheck = (async () => {
      store.setState({ cloudStatus: 'checking' });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch('/api/health', { signal: controller.signal });
        const isJson = (res.headers.get('content-type') || '').includes('application/json');
        const body = res.ok && isJson ? await res.json() : null;
        const services = body?.services && typeof body.services.vision === 'boolean' ? body.services : null;
        // An older backend without `services` is treated as up, as before.
        const online = !!body && services?.vision !== false;
        store.setState({
          cloudStatus: online ? 'online' : 'offline',
          remoteServices: body ? services : { vision: false, vectorize: false },
          remoteCheckedAt: Date.now()
        });
        return online;
      } catch {
        store.setState({ cloudStatus: 'offline', remoteServices: { vision: false, vectorize: false }, remoteCheckedAt: Date.now() });
        return false;
      } finally {
        clearTimeout(timer);
        this.healthCheck = null;
      }
    })();
    return this.healthCheck;
  }

  /** Re-probe before a remote-eligible step when the last probe is older than `maxAgeMs` (cloud mode only). */
  public static async refreshServiceStatus(maxAgeMs = 60000): Promise<void> {
    const state = store.getState();
    if (state.engineMode !== 'cloud' || Date.now() - state.remoteCheckedAt < maxAgeMs) return;
    await this.checkHealth();
  }

  /**
   * Downsample an image payload before uploading to a self-hosted service (keeps requests fast)
   */
  public static async optimizePayloadForUpload(
    sourceDataUrl: string,
    maxDimension: number = 1024,
    quality: number = 0.82
  ): Promise<string> {
    if (typeof document === 'undefined') return sourceDataUrl;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (w <= maxDimension && h <= maxDimension && sourceDataUrl.length < 500000) {
          resolve(sourceDataUrl);
          return;
        }

        if (w > h) {
          if (w > maxDimension) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          }
        } else {
          if (h > maxDimension) {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceDataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const optimizedUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(optimizedUrl);
      };

      img.onerror = () => resolve(sourceDataUrl);
      img.src = sourceDataUrl;
    });
  }

  /**
   * Validate image blob magic header
   */
  public static async validateImageBlob(blob: Blob): Promise<boolean> {
    if (!blob || blob.size < 8) return false;
    try {
      const buffer = await blob.slice(0, 8).arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // PNG: 89 50 4E 47 0D 0A 1A 0A
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      // JPEG: FF D8 FF
      const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      // WebP: RIFF ... WEBP
      const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;

      return isPng || isJpeg || isWebp;
    } catch {
      return false;
    }
  }
}
