/**
 * 🛡️ NetworkGuard — Privacy Shield & Upload Payload Helpers
 *
 * Privacy Shield is a real, functional toggle: when active, the app skips the self-hosted
 * services entirely (VTracer, and the PyTorch vision container's Retinexformer/Real-ESRGAN/
 * ARNIQA/LaMa/rembg/YuNet, all reachable at `/api/*`) and only ever runs the local deterministic
 * algorithms in src/core/ — nothing leaves the browser. When
 * inactive, the app still tries the self-hosted services first (better results) and gracefully
 * falls back to the same local algorithms if they're unreachable.
 *
 * There is no third-party cloud API involved either way — "self-hosted" here means the server you
 * (or whoever operates this deployment) run, not an external vendor.
 */
export class NetworkGuard {
  private static readonly STORAGE_PRIVACY_KEY = 'printmagic_privacy_shield_active';

  /**
   * Check if Privacy Shield is enabled (100% local-only mode — skip self-hosted services)
   */
  public static isPrivacyShieldActive(): boolean {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(this.STORAGE_PRIVACY_KEY) === 'true';
    }
    return false;
  }

  /**
   * Toggle Privacy Shield
   */
  public static setPrivacyShield(active: boolean): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.STORAGE_PRIVACY_KEY, active ? 'true' : 'false');
    }
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
