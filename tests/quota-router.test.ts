import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuotaRouter, type EngineCategory } from '../src/services/quota-router';

describe('QuotaRouter (Comprehensive 8-Domain Multi-Provider Quota & Quality Router)', () => {
  let storeMock: Record<string, string> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    storeMock = {};

    // @ts-ignore
    global.localStorage = {
      getItem: (k: string) => storeMock[k] || null,
      setItem: (k: string, v: string) => { storeMock[k] = v; },
      removeItem: (k: string) => { delete storeMock[k]; },
      clear: () => { storeMock = {}; }
    } as any;

    QuotaRouter.resetQuota();
  });

  const categories: EngineCategory[] = [
    'upscale',
    'matting',
    'inpainting',
    'vectorize',
    'lowlight',
    'crop',
    'ocr',
    'geo'
  ];

  it('should maintain strict quality score descending order across all 8 optimization categories', () => {
    for (const cat of categories) {
      const providers = QuotaRouter.getProviders(cat);
      expect(providers.length).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < providers.length - 1; i++) {
        expect(providers[i].qualityScore).toBeGreaterThanOrEqual(providers[i + 1].qualityScore);
      }

      // Every category must have a local unlimited fallback at the end
      const lastProvider = providers[providers.length - 1];
      expect(lastProvider.isLocalUnlimited).toBe(true);
    }
  });

  it('should pick the highest quality provider for inpainting, vectorize, lowlight, crop, and geo', () => {
    expect(QuotaRouter.getBestProvider('inpainting').id).toBe('inpainting-lama');
    expect(QuotaRouter.getBestProvider('vectorize').id).toBe('vectorize-vtracer');
    expect(QuotaRouter.getBestProvider('lowlight').id).toBe('lowlight-retinexformer');
    expect(QuotaRouter.getBestProvider('crop').id).toBe('crop-nanodet-plus');
    expect(QuotaRouter.getBestProvider('geo').id).toBe('geo-osm-overpass');
  });

  it('should auto-switch Inpainting from LaMa to MAT when remaining quota <= 10%', () => {
    const providers = QuotaRouter.getProviders('inpainting');
    const lama = providers[0]; // LaMa (200 quota)

    // Consume 185 requests (15 left = 7.5% <= 10%)
    lama.usedQuota = 185;
    expect(QuotaRouter.getRemainingPercent(lama)).toBeLessThanOrEqual(10);

    const nextBest = QuotaRouter.getBestProvider('inpainting');
    expect(nextBest.id).toBe('inpainting-mat');
    expect(nextBest.qualityScore).toBe(93);
  });

  it('should auto-switch Vectorize from VTracer to SVGCode and then AutoTrace when remaining quota <= 10%', () => {
    const providers = QuotaRouter.getProviders('vectorize');
    const vtracer = providers[0]; // VTracer (300 quota)

    vtracer.usedQuota = 280; // 20 left = 6.6% <= 10%
    expect(QuotaRouter.getBestProvider('vectorize').id).toBe('vectorize-svgcode');

    const svgcode = providers[1]; // SVGCode
    svgcode.usedQuota = 190; // <= 10%
    expect(QuotaRouter.getBestProvider('vectorize').id).toBe('vectorize-autotrace');
  });

  it('should auto-switch Lowlight from Retinexformer to Zero-DCE when remaining quota <= 10%', () => {
    const providers = QuotaRouter.getProviders('lowlight');
    const retinex = providers[0];

    retinex.usedQuota = 280; // <= 10%
    expect(QuotaRouter.getBestProvider('lowlight').id).toBe('lowlight-zero-dce');
  });

  it('should auto-switch Crop from NanoDet-Plus to DeepSaliency when remaining quota <= 10%', () => {
    const providers = QuotaRouter.getProviders('crop');
    const nanodet = providers[0]; // 1000 quota

    nanodet.usedQuota = 950; // 50 left = 5% <= 10%
    expect(QuotaRouter.getBestProvider('crop').id).toBe('crop-deepsaliency');
  });

  it('should auto-switch Geo from OSM Overpass to Nominatim on rate-limit', () => {
    const providers = QuotaRouter.getProviders('geo');
    const osm = providers[0];

    QuotaRouter.recordFailure(osm.id, true);
    expect(QuotaRouter.getBestProvider('geo').id).toBe('geo-nominatim');
  });

  it('should seamlessly fallback to Local Unlimited when all cloud tiers in a category are depleted', () => {
    for (const cat of categories) {
      const providers = QuotaRouter.getProviders(cat);
      for (const p of providers) {
        if (!p.isLocalUnlimited) {
          p.usedQuota = p.totalQuota; // 100% used
        }
      }

      const best = QuotaRouter.getBestProvider(cat);
      expect(best.isLocalUnlimited).toBe(true);
      expect(QuotaRouter.getRemainingPercent(best)).toBe(100);
    }
  });
});
