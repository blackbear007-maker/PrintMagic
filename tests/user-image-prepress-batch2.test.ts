import { describe, it, expect } from 'vitest';
import { ScreenshotDarkInverter } from '../src/core/screenshot-dark-inverter';
import { CanvasWrapMirror } from '../src/core/canvas-wrap-mirror';
import { PhotoFrameMat } from '../src/core/photo-frame-mat';
import { GridSplitterMultiPanel } from '../src/core/grid-splitter-multi-panel';
import { HolographicFoilMasker } from '../src/core/holographic-foil-masker';
import { FoldedGreetingCard } from '../src/core/folded-greeting-card';
import { ReceiptFadingRestorer } from '../src/core/receipt-fading-restorer';
import { WoodEngravingToner } from '../src/core/wood-engraving-toner';
import { FluorescentNeonExtractor } from '../src/core/fluorescent-neon-extractor';
import { WhiteboardGlareKeystone } from '../src/core/whiteboard-glare-keystone';
import { EmbroideryPatchConverter } from '../src/core/embroidery-patch-converter';
import { CanvasOilImpasto } from '../src/core/canvas-oil-impasto';
import { NutrientTableBuilder } from '../src/core/nutrient-table-builder';
import { WatermarkStampRemover } from '../src/core/watermark-stamp-remover';
import { BookmarkTasselPlanner } from '../src/core/bookmark-tassel-planner';
import { MetalCardLaserMasker } from '../src/core/metal-card-laser-masker';
import { WatercolorBleedSoftener } from '../src/core/watercolor-bleed-softener';
import { SeleniumMonochromeToner } from '../src/core/selenium-monochrome-toner';
import { PriceTagBatchTiler } from '../src/core/price-tag-batch-tiler';
import { BusinessCardSmartAligner } from '../src/core/business-card-smart-aligner';

describe('20 User-Facing Image Pre-Press Optimization Suite (Batch 2)', () => {
  const createMockImg = (w: number, h: number, r = 100, g = 100, b = 100, a = 255): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('01. ScreenshotDarkInverter: should invert dark background to paper white', () => {
    const img = createMockImg(10, 10, 20, 20, 20);
    const res = ScreenshotDarkInverter.invertDarkTheme(img, 80);
    expect(res.data[0]).toBe(255);
    expect(res.data[1]).toBe(255);
    expect(res.data[2]).toBe(255);
  });

  it('02. CanvasWrapMirror: should extend 4 borders with mirror reflection', () => {
    const img = createMockImg(20, 20, 150, 120, 80);
    const res = CanvasWrapMirror.generateCanvasWrap(img, 10);
    expect(res.width).toBe(40);
    expect(res.height).toBe(40);
  });

  it('03. PhotoFrameMat: should add gallery mat board white margin', () => {
    const img = createMockImg(20, 20);
    const res = PhotoFrameMat.generateMatBoard(img, 15);
    expect(res.mattedImageData.width).toBe(50);
    expect(res.borderWidthMm).toBeGreaterThan(0);
  });

  it('04. GridSplitterMultiPanel: should split poster into A4 tiles with overlap', () => {
    const img = createMockImg(100, 100);
    const tiles = GridSplitterMultiPanel.splitToA4Grid(img, 2, 2);
    expect(tiles.length).toBe(4);
    expect(tiles[0].overlapMarginMm).toBe(5.0);
  });

  it('05. HolographicFoilMasker: should generate solid white underbase for character', () => {
    const img = createMockImg(20, 20, 200, 50, 50, 255);
    const res = HolographicFoilMasker.generateHoloMask(img, 30);
    expect(res.characterSolidWhiteMask.data[3]).toBe(255);
    expect(res.holographicRainbowAreaPercent).toBe(0);
  });

  it('06. FoldedGreetingCard: should impose front and back covers with crease', () => {
    const front = createMockImg(20, 20);
    const back = createMockImg(20, 20);
    const res = FoldedGreetingCard.imposeCard(front, back);
    expect(res.imposedImageData.width).toBe(40);
    expect(res.creaseXPositionPx).toBe(20);
  });

  it('07. ReceiptFadingRestorer: should darken faded thermal text to black', () => {
    const img = createMockImg(10, 10, 180, 180, 180);
    const res = ReceiptFadingRestorer.restoreReceipt(img, 2.5);
    expect(res.data[0]).toBeLessThan(100);
  });

  it('08. WoodEngravingToner: should binarize continuous tones for laser burning', () => {
    const img = createMockImg(10, 10, 80, 80, 80);
    const res = WoodEngravingToner.toneForWood(img, 128);
    expect(res.data[0]).toBe(0);
    expect(res.data[3]).toBe(255);
  });

  it('09. FluorescentNeonExtractor: should extract 5th neon spot color plate', () => {
    const img = createMockImg(10, 10, 240, 50, 180);
    const res = FluorescentNeonExtractor.extractNeonChannel(img, 'pink');
    expect(res.spotColorName).toContain('Pantone 806');
    expect(res.coveragePercent).toBeGreaterThan(0);
  });

  it('10. WhiteboardGlareKeystone: should flatten specular glare hotspots to white', () => {
    const img = createMockImg(10, 10, 250, 250, 250);
    const res = WhiteboardGlareKeystone.cleanWhiteboard(img, 240);
    expect(res.data[0]).toBe(255);
  });

  it('11. EmbroideryPatchConverter: should quantize image to thread palette', () => {
    const img = createMockImg(20, 20, 100, 150, 200);
    const res = EmbroideryPatchConverter.convertToEmbroidery(img, 8);
    expect(res.threadPalette.length).toBeGreaterThan(0);
    expect(res.totalThreadsUsed).toBeGreaterThan(0);
  });

  it('12. CanvasOilImpasto: should generate 3D impasto heightmap', () => {
    const img = createMockImg(20, 20, 120, 120, 120);
    const res = CanvasOilImpasto.generateImpasto(img, 0.45);
    expect(res.normalBumpMap.width).toBe(20);
    expect(res.tactileUvHeightmap.width).toBe(20);
    expect(res.maxReliefDepthMm).toBe(0.45);
  });

  it('13. NutrientTableBuilder: should build compliant SVG nutrition table', () => {
    const svg = NutrientTableBuilder.buildTableSvg({
      servingsPerPackage: 4,
      servingSizeGrams: 50,
      caloriesKcal: 220,
      proteinGrams: 5.2,
      totalFatGrams: 8.4,
      carbsGrams: 30.1,
      sugarGrams: 12.0,
      sodiumMg: 140
    }, 300);
    expect(svg).toContain('營養標示');
    expect(svg).toContain('220 大卡');
  });

  it('14. WatermarkStampRemover: should inpaint date stamps and watermarks', () => {
    const img = createMockImg(10, 10, 245, 100, 100);
    const res = WatermarkStampRemover.removeWatermark(img, 200);
    expect(res.width).toBe(10);
  });

  it('15. BookmarkTasselPlanner: should plan 5x15cm bookmark dieline with punch hole', () => {
    const img = createMockImg(50, 150);
    const res = BookmarkTasselPlanner.planBookmark(img, 50, 150);
    expect(res.dielineSvg).toContain('Tassel');
    expect(res.bookmarkDimensionsMm).toBe('50 × 150 mm');
  });

  it('16. MetalCardLaserMasker: should generate 100% K100 laser etching mask', () => {
    const img = createMockImg(10, 10, 200, 200, 200);
    const res = MetalCardLaserMasker.generateMetalLaserMask(img, 128);
    expect(res.data[0]).toBe(0);
    expect(res.data[3]).toBe(255);
  });

  it('17. WatercolorBleedSoftener: should simulate watercolor edge water-ring bleeding', () => {
    const img = createMockImg(20, 20, 150, 180, 220);
    const res = WatercolorBleedSoftener.softenWatercolorEdges(img, 2);
    expect(res.width).toBe(20);
  });

  it('18. SeleniumMonochromeToner: should apply darkroom selenium toning', () => {
    const img = createMockImg(10, 10, 60, 60, 60);
    const res = SeleniumMonochromeToner.toneSelenium(img, 0.35);
    expect(res.width).toBe(10);
  });

  it('19. PriceTagBatchTiler: should tile batch price tags onto A4 sticker sheet', () => {
    const svg = PriceTagBatchTiler.tilePriceTags([
      { productName: '手工餅乾', priceNtd: 120 },
      { productName: '草莓果醬', priceNtd: 250 }
    ], 3, 7);
    expect(svg).toContain('手工餅乾');
    expect(svg).toContain('NT$ 120');
  });

  it('20. BusinessCardSmartAligner: should align contact info to Swiss modular grid', () => {
    const svg = BusinessCardSmartAligner.alignCardTypography({
      name: '王小明',
      title: '資深設計總監',
      phone: '0912-345-678',
      email: 'alex@studio.design',
      website: 'www.studio.design'
    }, 90, 54);
    expect(svg).toContain('王小明');
    expect(svg).toContain('TEL: 0912-345-678');
  });
});
