/**
 * Zero-DCE++ Microservice Proxy
 *
 * This file previously dispatched to 6 "SOTA" endpoints (BiRefNet matting, MobileSAM segment,
 * Zero-DCE++ lowlight, RealESRGAN upscale, PP-OCR, DocTr dewarp). Those five other methods were
 * either pure lies (processSegment/processDewarp returned success:true with the untouched input
 * and never made a network call) or broken on both ends (processMatting/processUpscale/processOcr
 * called endpoints that either didn't exist or spoke an incompatible request format). They've been
 * removed; matting, upscale, and OCR are each handled directly by their own client now, either
 * against a real backend (Tesseract OCR, VTracer vectorize) or a local deterministic algorithm.
 *
 * ⚠️ Zero-DCE++ itself is NOT a working trained model (corrected 2026-08-25, after this file
 * previously and incorrectly called it "the one real model in the stack"): docker/zero-dce/
 * server.py's network architecture is genuine Zero-DCE++ code, but it never loads trained weights
 * — no `.pth` checkpoint has ever existed in this repo. It runs on PyTorch's random initial
 * weights. This proxy still calls it (the endpoint path bug — this used to call `/lowlight`,
 * which the service never exposed — has been fixed, so the call itself now succeeds), but "succeeds"
 * only means "the untrained network ran without crashing," not "produced a meaningful result."
 */
export class AiEngineService {
  private static readonly BASE_URL = process.env.ZERO_DCE_URL || process.env.AI_ENGINE_URL || 'http://127.0.0.1:8082';

  /**
   * Zero-DCE++ Low-Light Enhancement — runs the real network architecture, but with untrained
   * (randomly initialized) weights. See the honesty note at the top of this file.
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
          return { success: true, dataUrl: data.image_base64, engine: 'Zero-DCE++ (自建微服務，⚠️ 未訓練權重)' };
        }
      }
      return { success: false, error: `Zero-DCE++ service returned HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Zero-DCE++ service unavailable' };
    }
  }
}
