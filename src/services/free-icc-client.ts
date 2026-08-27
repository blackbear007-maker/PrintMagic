import { NetworkGuard } from './network-guard';

/**
 * Real ICC Soft-Proof Client (self-hosted LittleCMS via Pillow's ImageCms, no local fallback)
 *
 * Added 2026-08-27. This is an ADDITIVE, parallel capability alongside the project's existing
 * hand-rolled approximate soft-proof (`CmykEngine.simulatePrintProof()` in src/core/cmyk-engine.ts)
 * and TAC display (`src/core/ink-limiter.ts`) — it does not replace either. Those existing systems
 * work with zero setup (no profile required) using fixed formulas; this client only activates once
 * the user has uploaded their OWN CMYK ICC profile (e.g. their print shop's actual profile), and
 * then performs a real color-managed transform through that exact profile via LittleCMS.
 *
 * Why user-uploaded only: this project does not bundle/redistribute any named press profile
 * (FOGRA/SWOP/GRACoL/etc.) of its own — verified 2026-08-27 that even the ICC's own official
 * profile registry marks those files "may not be distributed, sold or altered without written
 * permission." Accepting the user's own profile file sidesteps that redistribution question
 * entirely since this project never ships or copies anyone else's profile.
 *
 * There is no local fallback for the REAL transform itself (a genuine ICC v2/v4 color transform
 * cannot be approximated client-side without a real CMM) — when unavailable, callers should fall
 * back to the existing `CmykEngine.simulatePrintProof()` approximate simulation, not invent a fake
 * "real" result.
 *
 * Flow:
 * 1. Privacy Shield active -> skip the network entirely, report unavailable.
 * 2. Otherwise, attempt the self-hosted LittleCMS microservice (/api/ai/icc-soft-proof ->
 *    docker/zero-dce/, Pillow's ImageCms, MIT/LittleCMS license). Verified 2026-08-27 with a real
 *    CMYK profile: soft-proofing measurably shifted colors (mean RGB diff 19.83 on a test
 *    gradient) and real per-pixel TAC came out at sensible values (max 212.2%, mean 135.6%).
 * 3. Report unavailable if the service is unreachable, the engine isn't available, or the
 *    uploaded profile is rejected (e.g. not actually a CMYK profile).
 */
export interface IccSoftProofResult {
  available: boolean;
  dataUrl?: string;
  tac?: { maxPercent: number; meanPercent: number; minPercent: number };
  profileName?: string;
  engine: string;
  error?: string;
}

export class FreeIccClient {
  public static async softProof(imageData: ImageData, iccProfileBytes: ArrayBuffer): Promise<IccSoftProofResult> {
    if (NetworkGuard.isPrivacyShieldActive()) {
      return {
        available: false,
        engine: '100% 本機模式已開啟，真實 ICC 校色不可用（改用近似色彩模擬）'
      };
    }

    const cloudResult = await this.tryIccService(imageData, iccProfileBytes);
    if (cloudResult) return cloudResult;

    return {
      available: false,
      engine: 'ICC 校色服務離線，暫時不可用（改用近似色彩模擬）'
    };
  }

  private static async tryIccService(
    imageData: ImageData,
    iccProfileBytes: ArrayBuffer
  ): Promise<IccSoftProofResult | null> {
    try {
      const dataUrl = this.imageDataToDataUrl(imageData);
      if (!dataUrl) return null;

      const profileBase64 = this.arrayBufferToBase64(iccProfileBytes);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch('/api/ai/icc-soft-proof', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: dataUrl, icc_profile_base64: profileBase64 }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => undefined);
        return {
          available: false,
          engine: 'ICC 校色失敗（改用近似色彩模擬）',
          error: errData?.error
        };
      }
      const data = await res.json();
      if (!data.success) {
        return { available: false, engine: 'ICC 校色失敗（改用近似色彩模擬）', error: data.error };
      }

      return {
        available: true,
        dataUrl: data.dataUrl,
        tac: data.tac,
        profileName: data.profileName,
        engine: data.engine || 'LittleCMS (自建服務)'
      };
    } catch {
      return null;
    }
  }

  private static imageDataToDataUrl(imageData: ImageData): string {
    if (typeof document === 'undefined') return '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }
}
