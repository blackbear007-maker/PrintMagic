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
 * The five methods below (processLowLight, processUpscale,
 * processInpaint, processMatting, processDetectFace) now proxy to genuinely trained real models
 * when their weight files are present on the server side. Retinexformer has
 * no automatable download URL, so a human sourced its weight file manually once (2026-08-26)
 * and it was committed directly to git (see docker/zero-dce/weights/README.md) — Railway builds
 * this service from the git repo, not local disk, so a gitignored weight file would never have
 * actually reached the deployed container. If that file is ever removed without a replacement,
 * the service reports 503 honestly rather than running untrained/random weights. LaMa
 * (processInpaint), added 2026-08-26, is auto-downloaded at build time like Real-ESRGAN —
 * verified with a real downloaded checkpoint that it cleanly removes a solid-color test region
 * (i.e. object/watermark removal). rembg/u2netp (processMatting) and YuNet (processDetectFace),
 * both added 2026-08-27, run on ONNX Runtime/OpenCV's DNN backend rather than PyTorch — verified
 * with real downloaded weights: rembg correctly separated a solid test subject from a textured,
 * non-uniform background (something the local color-key fallback, AiMatting, cannot do), and
 * YuNet correctly detected a face on a synthetic shaded test image at 84.2% confidence.
 *
 * ⚠️ processDehaze (DehazeFormer-T) was added 2026-08-26 and removed 2026-08-27 after evaluation:
 * it genuinely worked, but dehaze only helps a narrow slice of this app's actual print jobs (hazy
 * outdoor/landscape photos) and isn't a print-specific need — see docs/SPEC.md's rejected-models
 * section. The local ContrastDehazeFilter fallback was removed the same day too, once it became
 * clear pre-press processing doesn't need dehaze at all — there is no dehaze feature left in this
 * app, client-side or otherwise.
 *
 * ⚠️ processQuality (ARNIQA) was added 2026-08-25, genuinely wired into the main pipeline, and
 * removed 2026-08-29 after evaluation: it worked correctly, but its training basis (KonIQ-10k and
 * similar general-photo human-perception datasets) measures "does this look good on a screen," not
 * "will this print correctly" — the same category GFPGAN/DDColor were rejected for. See
 * docs/SPEC.md's rejected-models section. Quality scoring now runs entirely on the local
 * PixelStatQualityAssessor heuristic; no cloud call is attempted for it anymore.
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

  /**
   * rembg (u2netp session) background removal — real trained weights (MIT), auto-downloaded at
   * build time. Deliberately pinned server-side to the u2netp model, never rembg's own default
   * session (which can resolve to a non-commercial model) — see server.py's honesty note.
   */
  public static async processMatting(imageDataUrl: string): Promise<{ success: boolean; dataUrl?: string; engine?: string; error?: string }> {
    try {
      const { ok, status, data } = await this.postImage('/matting', imageDataUrl, 15000);
      if (ok && data?.success && data.image_base64) {
        return { success: true, dataUrl: data.image_base64, engine: 'rembg u2netp (自建微服務)' };
      }
      if (status === 503) {
        return { success: false, error: data?.error || 'rembg service unavailable' };
      }
      return { success: false, error: `rembg service returned HTTP ${status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'rembg service unavailable' };
    }
  }

  /**
   * YuNet face detection — real trained weights (Apache-2.0/MIT), auto-downloaded at build time.
   * Returns face bounding boxes + 5-point landmarks as JSON, not a processed image, so this
   * doesn't go through the shared postImage() helper's image-response assumption.
   */
  public static async processDetectFace(imageDataUrl: string): Promise<{ success: boolean; faces?: any[]; imageWidth?: number; imageHeight?: number; engine?: string; error?: string }> {
    try {
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const formData = new FormData();
      formData.append('image', new Blob([buffer], { type: 'image/png' }), 'input.png');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      let res: Response;
      try {
        res = await fetch(`${this.BASE_URL}/detect-face`, { method: 'POST', body: formData, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      const data = res.ok || res.status === 503 ? await res.json().catch(() => undefined) : undefined;

      if (res.ok && data?.success) {
        return {
          success: true,
          faces: data.faces || [],
          imageWidth: data.imageWidth,
          imageHeight: data.imageHeight,
          engine: 'YuNet (自建微服務)'
        };
      }
      if (res.status === 503) {
        return { success: false, error: data?.error || 'YuNet weights not present' };
      }
      return { success: false, error: `YuNet service returned HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'YuNet service unavailable' };
    }
  }

  /**
   * Real ICC soft-proof + ink coverage (TAC) via Pillow's ImageCms/LittleCMS (MIT), added
   * 2026-08-27. Requires the CALLER to supply their own CMYK .icc/.icm profile — this project
   * deliberately does not bundle any named press profile (FOGRA/SWOP/GRACoL/etc.), since those
   * carry real redistribution restrictions (verified against the ICC's own profile registry).
   * Verified with a real CMYK profile: soft-proofing measurably shifted colors and real per-pixel
   * TAC came out at sensible values — see docker/zero-dce/server.py's header comment.
   */
  public static async processIccSoftProof(
    imageDataUrl: string,
    iccProfileBase64: string
  ): Promise<{
    success: boolean;
    dataUrl?: string;
    tac?: { maxPercent: number; meanPercent: number; minPercent: number };
    profileName?: string;
    engine?: string;
    error?: string;
  }> {
    try {
      const toBuffer = (dataUrl: string) =>
        Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');

      const formData = new FormData();
      formData.append('image', new Blob([toBuffer(imageDataUrl)], { type: 'image/png' }), 'input.png');
      formData.append(
        'icc_profile',
        new Blob([Buffer.from(iccProfileBase64, 'base64')], { type: 'application/octet-stream' }),
        'profile.icc'
      );

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(`${this.BASE_URL}/icc/soft-proof`, { method: 'POST', body: formData, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      const data = res.ok || res.status === 503 || res.status === 400 ? await res.json().catch(() => undefined) : undefined;

      if (res.ok && data?.success && data.image_base64) {
        return {
          success: true,
          dataUrl: data.image_base64,
          tac: data.tac,
          profileName: data.profileName,
          engine: 'LittleCMS (自建微服務)'
        };
      }
      if (res.status === 400) {
        return { success: false, error: data?.error || 'Invalid ICC profile or missing image' };
      }
      if (res.status === 503) {
        return { success: false, error: data?.error || 'ICC engine unavailable' };
      }
      return { success: false, error: `ICC service returned HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'ICC service unavailable' };
    }
  }
}
