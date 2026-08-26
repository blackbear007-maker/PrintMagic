import { PixelStatQualityAssessor, type PixelStatQualityResult } from '../core/pixel-stat-quality-assessor';
import { NetworkGuard } from './network-guard';

/**
 * Quality Assessment Client (self-hosted ARNIQA / local pixel-stat fallback)
 *
 * Flow, added 2026-08-26 (previously 100% local — PixelStatQualityAssessor's own honesty note
 * still applies to the fallback path: it's a pixel-statistic heuristic, not a trained model):
 * 1. Privacy Shield active -> skip the network entirely, run PixelStatQualityAssessor locally.
 * 2. Otherwise, attempt the self-hosted ARNIQA microservice (/api/ai/quality -> docker/zero-dce/,
 *    real trained Apache-2.0 weights, WACV 2024). ARNIQA returns a single 0-1 no-reference
 *    quality score with no technical/aesthetic breakdown, so this maps it onto the same 0-100
 *    PixelStatQualityResult shape the rest of the app already expects — technicalClarityScore and
 *    aestheticQualityScore mirror the overall score in that case rather than being independently
 *    measured, since ARNIQA doesn't decompose them the way the local heuristic does.
 * 3. Fallback -> local PixelStatQualityAssessor if the service is unreachable or unavailable.
 */
export interface QualityAssessmentResult extends PixelStatQualityResult {
  isCloud: boolean;
  engine: string;
}

export class FreeQualityClient {
  public static async assess(imageData: ImageData): Promise<QualityAssessmentResult> {
    if (!NetworkGuard.isPrivacyShieldActive()) {
      const cloudResult = await this.tryArniqa(imageData);
      if (cloudResult) return cloudResult;
    }

    const local = PixelStatQualityAssessor.assess(imageData);
    return { ...local, isCloud: false, engine: '本機像素統計評估' };
  }

  private static async tryArniqa(imageData: ImageData): Promise<QualityAssessmentResult | null> {
    try {
      const dataUrl = this.imageDataToDataUrl(imageData);
      if (!dataUrl) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/ai/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: dataUrl }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success || typeof data.score !== 'number') return null;

      // ARNIQA: 0-1, higher = better. Map onto the app's existing 0-100 scale/grade thresholds.
      const score = Number((data.score * 100).toFixed(1));
      let grade: PixelStatQualityResult['grade'] = 'EXCELLENT';
      if (score < 70) grade = 'POOR';
      else if (score < 80) grade = 'FAIR';
      else if (score < 90) grade = 'GOOD';

      return {
        score,
        technicalClarityScore: score,
        aestheticQualityScore: score,
        grade,
        detectedFlaws: [],
        recommendations: [],
        isCloud: true,
        engine: '自建 ARNIQA 服務'
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
}
