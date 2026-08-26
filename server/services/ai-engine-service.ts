/**
 * PyTorch CPU Vision Microservice Proxy
 *
 * This file previously dispatched to 6 "SOTA" endpoints (BiRefNet matting, MobileSAM segment,
 * Zero-DCE++ lowlight, RealESRGAN upscale, PP-OCR, DocTr dewarp). Those five other methods were
 * either pure lies (processSegment/processDewarp returned success:true with the untouched input
 * and never made a network call) or broken on both ends (processMatting/processUpscale/processOcr
 * called endpoints that either didn't exist or spoke an incompatible request format). They've been
 * removed; matting is handled by its own local client. OCR (Tesseract) was removed entirely
 * 2026-08-26 — see docker-compose.yml's note for why.
 *
 * ⚠️ HISTORY: processLowLight used to run Zero-DCE++ with random (never-trained) weights —
 * corrected 2026-08-26 by replacing the model behind /enhance with **Retinexformer** (ICCV 2023,
 * MIT), which does have a real trained checkpoint. Verified 2026-08-26 by actually loading a real
 * downloaded copy of `LOL_v2_real.pth`: `strict=True` state_dict load succeeded with 0 missing/0
 * unexpected keys across 122 tensors, and real inference on a test image correctly brightened it.
 * See docker/zero-dce/server.py's header comment for full details.
 *
 * All five methods below (processLowLight, processUpscale, processDehaze, processQuality,
 * processInpaint) now proxy to genuinely trained real models when their weight files are present
 * on the server side. Retinexformer and DehazeFormer-T have no automatable download URL, so a
 * human sourced their weight file manually once (2026-08-26) and it was committed directly to git
 * (see docker/zero-dce/weights/README.md) — Railway builds this service from the git repo, not
 * local disk, so a gitignored weight file would never have actually reached the deployed
 * container. If either file is ever removed without a replacement, the service reports 503
 * honestly rather than running untrained/random weights. LaMa (processInpaint), added 2026-08-26,
 * is auto-downloaded at build time like Real-ESRGAN/ARNIQA — verified with a real downloaded
 * checkpoint that it cleanly removes a solid-color test region (i.e. object/watermark removal).
 */
export class AiEngineService {
  private static readonly BASE_URL = process.env.ZERO_DCE_URL || process.env.AI_ENGINE_URL || 'http://127.0.0.1:8082';

  private static async postImage(
    endpoint: string,
    imageDataUrl: string,
    timeoutMs: number
  ): Promise<{ ok: boolean; status: number; data?: any }> {
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('image', blob, 'input.png');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      const data = res.ok || res.status === 503 ? await res.json().catch(() => undefined) : undefined;
      return { ok: res.ok, status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Retinexformer low-light enhancement — real trained weights, committed to git (MIT). Returns
   * success:false with a clear reason (not a crash) if the weight file were ever missing —
   * see docker/zero-dce/weights/README.md.
   */
  public static async processLowLight(imageDataUrl: string): Promise<{ success: boolean; dataUrl?: string; engine?: string; error?: string }> {
    try {
      const { ok, status, data } = await this.postImage('/enhance', imageDataUrl, 10000);
      if (ok && data?.success && data.image_base64) {
        return { success: true, dataUrl: data.image_base64, engine: 'Retinexformer (自建微服務)' };
      }
      if (status === 503) {
        return { success: false, error: data?.error || 'Retinexformer weights not sourced' };
      }
      return { success: false, error: `Retinexformer service returned HTTP ${status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Retinexformer service unavailable' };
    }
  }

  /**
   * Real-ESRGAN compact (x4v3) upscale — real trained weights (BSD-3-Clause). 20s timeout since
   * super-resolution is slower than the other three endpoints on CPU.
   */
  public static async processUpscale(imageDataUrl: string): Promise<{ success: boolean; dataUrl?: string; engine?: string; error?: string }> {
    try {
      const { ok, status, data } = await this.postImage('/upscale', imageDataUrl, 20000);
      if (ok && data?.success && data.image_base64) {
        return { success: true, dataUrl: data.image_base64, engine: 'Real-ESRGAN compact x4v3 (自建微服務)' };
      }
      if (status === 503) {
        return { success: false, error: data?.error || 'Real-ESRGAN service unavailable' };
      }
      return { success: false, error: `Real-ESRGAN service returned HTTP ${status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Real-ESRGAN service unavailable' };
    }
  }

  /**
   * DehazeFormer-T dehaze — real trained weights, committed to git (MIT). Returns
   * success:false with a clear reason (not a crash) if the weight file were ever missing —
   * see docker/zero-dce/weights/README.md.
   */
  public static async processDehaze(imageDataUrl: string): Promise<{ success: boolean; dataUrl?: string; engine?: string; error?: string }> {
    try {
      const { ok, status, data } = await this.postImage('/dehaze', imageDataUrl, 10000);
      if (ok && data?.success && data.image_base64) {
        return { success: true, dataUrl: data.image_base64, engine: 'DehazeFormer-T (自建微服務)' };
      }
      if (status === 503) {
        return { success: false, error: data?.error || 'DehazeFormer-T weights not sourced' };
      }
      return { success: false, error: `DehazeFormer-T service returned HTTP ${status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'DehazeFormer-T service unavailable' };
    }
  }

  /**
   * ARNIQA no-reference quality score — real trained weights (Apache-2.0). Returns a 0-1 score,
   * higher = better perceived quality, per the koniq10k regressor.
   */
  public static async processQuality(imageDataUrl: string): Promise<{ success: boolean; score?: number; engine?: string; error?: string }> {
    try {
      const { ok, status, data } = await this.postImage('/quality', imageDataUrl, 10000);
      if (ok && data?.success && typeof data.score === 'number') {
        return { success: true, score: data.score, engine: 'ARNIQA (自建微服務)' };
      }
      if (status === 503) {
        return { success: false, error: data?.error || 'ARNIQA service unavailable' };
      }
      return { success: false, error: `ARNIQA service returned HTTP ${status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'ARNIQA service unavailable' };
    }
  }

  /**
   * LaMa object/watermark removal — real trained weights (Apache-2.0), auto-downloaded at build
   * time. Unlike the other four, this needs both a source image AND a mask (white/opaque =
   * region to remove), so it doesn't go through the shared postImage() helper.
   */
  public static async processInpaint(
    imageDataUrl: string,
    maskDataUrl: string
  ): Promise<{ success: boolean; dataUrl?: string; engine?: string; error?: string }> {
    try {
      const toBuffer = (dataUrl: string) =>
        Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');

      const formData = new FormData();
      formData.append('image', new Blob([toBuffer(imageDataUrl)], { type: 'image/png' }), 'input.png');
      formData.append('mask', new Blob([toBuffer(maskDataUrl)], { type: 'image/png' }), 'mask.png');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      let res: Response;
      try {
        res = await fetch(`${this.BASE_URL}/inpaint`, { method: 'POST', body: formData, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      const data = res.ok || res.status === 503 ? await res.json().catch(() => undefined) : undefined;

      if (res.ok && data?.success && data.image_base64) {
        return { success: true, dataUrl: data.image_base64, engine: 'LaMa (自建微服務)' };
      }
      if (res.status === 503) {
        return { success: false, error: data?.error || 'LaMa weights not sourced' };
      }
      return { success: false, error: `LaMa service returned HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'LaMa service unavailable' };
    }
  }
}
