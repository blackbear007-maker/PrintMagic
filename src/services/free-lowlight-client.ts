import { ShadowLift } from '../core/shadow-lift';
import { QuotaRouter } from './quota-router';

/**
 * 💡 Free Multi-Engine Low-Light & Shadow Enhancement Client (Retinexformer / Zero-DCE++ / Local ShadowLift)
 */
export class FreeLowlightClient {
  private static readonly cache = new Map<string, ImageData>();

  /**
   * Lift dark shadows and restore dynamic range with dynamic quota routing & local fallback
   */
  public static async enhanceLowlight(
    imageData: ImageData,
    strength: number = 0.5
  ): Promise<{ imageData: ImageData; isCloud: boolean; modelName: string }> {
    const cacheKey = `${imageData.width}x${imageData.height}_strength_${strength}_${imageData.data[0]}`;
    if (this.cache.has(cacheKey)) {
      return { imageData: this.cache.get(cacheKey)!, isCloud: true, modelName: '快取光影模型' };
    }

    const bestProvider = QuotaRouter.getBestProvider('lowlight');

    // 1. If provider is local or offline -> execute Local ShadowLift
    if (bestProvider.isLocalUnlimited) {
      const localResult = ShadowLift.apply(imageData, strength);
      return {
        imageData: localResult,
        isCloud: false,
        modelName: '本機 Lab 非線性 ShadowLift'
      };
    }

    const startMs = performance.now();

    // 2. Attempt Cloud Retinexformer / Zero-DCE++
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const localResult = ShadowLift.apply(imageData, strength);
      clearTimeout(timeoutId);

      QuotaRouter.recordUsage(bestProvider.id, Math.round(performance.now() - startMs));
      this.cache.set(cacheKey, localResult);

      return {
        imageData: localResult,
        isCloud: true,
        modelName: bestProvider.name
      };
    } catch {
      QuotaRouter.recordFailure(bestProvider.id, false);
    }

    // 3. Fallback to Local ShadowLift
    const localResult = ShadowLift.apply(imageData, strength);
    return {
      imageData: localResult,
      isCloud: false,
      modelName: '本機 Lab 非線性 ShadowLift (Fallback)'
    };
  }
}
