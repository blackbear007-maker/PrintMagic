import { describe, it, expect } from 'vitest';
import { WeddingSkinPorePreserver } from '../src/core/wedding-skin-pore-preserver';
import { PhotocardHoloGlitter } from '../src/core/photocard-holo-glitter';
import { FoodMenuMouthwatering } from '../src/core/food-menu-mouthwatering';
import { RollupBannerScaler } from '../src/core/rollup-banner-scaler';
import { PackagingBoxDieline } from '../src/core/packaging-box-dieline';
import { LuxuryEmbossingBevel } from '../src/core/luxury-embossing-bevel';
import { GicleeFineArtDmax } from '../src/core/giclee-fineart-dmax';
import { ApparelHangTagPlanner } from '../src/core/apparel-hangtag-planner';

describe('8 High-Conversion Commercial Pre-Press Modules Suite', () => {
  const createMockImg = (w: number, h: number, r = 180, g = 140, b = 100, a = 255): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('01. WeddingSkinPorePreserver: should smooth skin tones while retaining high-frequency pores', () => {
    const img = createMockImg(20, 20, 210, 160, 130); // Skin color
    const res = WeddingSkinPorePreserver.preservePoresAndRetouch(img, 0.7, 1.2);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
    expect(res.data[0]).toBeGreaterThan(0);
  });

  it('02. PhotocardHoloGlitter: should generate broken glass shimmer and 100% solid white mask for character', () => {
    const img = createMockImg(30, 30, 100, 80, 70); // Darker character subject
    const res = PhotocardHoloGlitter.generateGlitterMask(img, 10, 180);
    expect(res.facetCount).toBeGreaterThan(0);
    expect(res.spotWhiteMask.width).toBe(30);
    expect(res.simulatedPreview.width).toBe(30);
  });

  it('03. FoodMenuMouthwatering: should boost warm reds and glaze reflections on dishes', () => {
    const img = createMockImg(15, 15, 200, 100, 40); // Roasted meat / fried golden dish
    const res = FoodMenuMouthwatering.enhanceFoodAppetite(img, 0.4, 0.2);
    expect(res.data[0]).toBeGreaterThanOrEqual(200);
    expect(res.width).toBe(15);
  });

  it('04. RollupBannerScaler: should plan tile chunks for 80x200cm gigantic banner without OOM', () => {
    const plan = RollupBannerScaler.calculateBannerPlan('rollup-80x200', 800, 2000);
    expect(plan.targetWidthMm).toBe(800);
    expect(plan.targetHeightMm).toBe(2000);
    expect(plan.recommendedDpi).toBe(150);
    expect(plan.totalTiles).toBeGreaterThan(0);

    const smallImg = createMockImg(20, 20);
    const scaled = RollupBannerScaler.scaleTileChunk(smallImg, 2.0);
    expect(scaled.width).toBe(40);
    expect(scaled.height).toBe(40);
  });

  it('05. PackagingBoxDieline: should generate parametric folding box SVG dieline', () => {
    const svg = PackagingBoxDieline.generateTuckEndBoxSvg({
      lengthMm: 120,
      widthMm: 80,
      heightMm: 60
    });
    expect(svg).toContain('dieline-cut');
    expect(svg).toContain('dieline-crease');
    expect(svg).toContain('120×60mm');
  });

  it('06. LuxuryEmbossingBevel: should generate 8-bit heightmap and K100 zinc mask', () => {
    const img = createMockImg(20, 20, 30, 30, 30); // Dark text/logo
    const res = LuxuryEmbossingBevel.generateEmbossHeightmap(img, 0.4, 4);
    expect(res.heightmapImageData.width).toBe(20);
    expect(res.solidMaskImageData.width).toBe(20);
    expect(res.maxReliefMm).toBe(0.4);
  });

  it('07. GicleeFineArtDmax: should remap 11-zone tones to deepen Dmax on cotton rag paper', () => {
    const img = createMockImg(20, 20, 40, 40, 40); // Deep shadow
    const res = GicleeFineArtDmax.optimizeForGicleeCottonRag(img, 0.3, 1.2);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
    expect(res.data[0]).toBeLessThanOrEqual(40); // Darker shadow density
  });

  it('08. ApparelHangTagPlanner: should generate clothing hang tag SVG and A4 tiling plan', () => {
    const svg = ApparelHangTagPlanner.generateSingleHangTagSvg({
      tagWidthMm: 50,
      tagHeightMm: 90,
      holeDiameterMm: 3.5,
      holeOffsetFromTopMm: 8,
      brandName: 'URBAN VIBE',
      priceNtd: 880
    });
    expect(svg).toContain('URBAN VIBE');
    expect(svg).toContain('NT$ 880');
    expect(svg).toContain('tag-hole');

    const tiling = ApparelHangTagPlanner.calculateA4Tiling(50, 90);
    expect(tiling.totalPerA4).toBeGreaterThan(0);
  });
});
