/**
 * Zero-DCE++ Microservice Proxy (the one real model in the self-hosted AI stack)
 *
 * This file previously dispatched to 6 "SOTA" endpoints (BiRefNet matting, MobileSAM segment,
 * Zero-DCE++ lowlight, RealESRGAN upscale, PP-OCR, DocTr dewarp). Only Zero-DCE++ is backed by an
 * actual model (docker/zero-dce/server.py). The other five were either pure lies (processSegment
 * and processDewarp returned success:true with the untouched input and never made a network call
 * at all) or broken on both ends (processMatting/processUpscale/processOcr called endpoints that
 * either didn't exist or spoke an incompatible request format, and on any failure still returned
 * success:true with the original image and a fabricated "本機 XXX 加速" label — never actually
 * running a local model either). Those five methods have been removed; matting, upscale, and OCR
 * are each handled directly by their own client, either against a real backend (Tesseract OCR,
 * VTracer vectorize) or a local deterministic algorithm (see src/services and src/core).
 *
 * The endpoint path bug (this used to call `/lowlight`, which docker/zero-dce/server.py never
 * exposed — only `/enhance` — meaning this path silently never worked either) has been fixed.
 */
export class AiEngineService {
  private static readonly BASE_URL = process.env.ZERO_DCE_URL || process.env.AI_ENGINE_URL || 'http://127.0.0.1:8082';

  /**
   * Zero-DCE++ Low-Light Enhancement (real model inference)
   */
  public static async processLowLight(imageDataUrl: string): Promise<{ success: boolean; dataUrl?: string; engine?: string; error?: string }> {
    try {
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'image/png' });
      formData.append('image', blob, 'input.png');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${this.BASE_URL}/enhance`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.image_base64) {
          return { success: true, dataUrl: data.image_base64, engine: 'Zero-DCE++ (自建微服務，真實推論)' };
        }
      }
      return { success: false, error: `Zero-DCE++ service returned HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Zero-DCE++ service unavailable' };
    }
  }
}
