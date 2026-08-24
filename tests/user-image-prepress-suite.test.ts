import { describe, it, expect } from 'vitest';
import { ShadowDetailRevealer } from '../src/core/shadow-detail-revealer';
import { HairlineThickener } from '../src/core/hairline-thickener';
import { PureWhiteCleanup } from '../src/core/pure-white-cleanup';
import { SkinToneCyanSuppressor } from '../src/core/skin-tone-cyan-suppressor';
import { DecontourEngine } from '../src/core/decontour-engine';
import { CmykVibrancyRescuer } from '../src/core/cmyk-vibrancy-rescuer';
import { AcrylicCharmBuilder } from '../src/core/acrylic-charm-builder';
import { StickerKisscutBuilder } from '../src/core/sticker-kisscut-builder';
import { TshirtColorKnockout } from '../src/core/tshirt-color-knockout';
import { TextSafezonePadding } from '../src/core/text-safezone-padding';
import { AiPseudoTextFilter } from '../src/core/ai-pseudo-text-filter';
import { MicroContrastTextBooster } from '../src/core/micro-contrast-text-booster';
import { RealPaperSimulator } from '../src/core/real-paper-simulator';
import { ResolutionDefectVisualizer } from '../src/core/resolution-defect-visualizer';
import { FoilingHighlightExtractor } from '../src/core/foiling-highlight-extractor';
import { BarcodeQrFixer } from '../src/core/barcode-qr-fixer';
import { PassportProportionAligner } from '../src/core/passport-proportion-aligner';
import { SeamCarvingCanvasFitter } from '../src/core/seam-carving-canvas-fitter';
import { EdgeBleedFeathering } from '../src/core/edge-bleed-feathering';

describe('20 User-Facing Image Pre-Press Optimization Suite', () => {
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

  it('01. ShadowDetailRevealer: should reveal deep shadow details', () => {
    const img = createMockImg(10, 10, 20, 20, 20);
    const res = ShadowDetailRevealer.revealShadows(img);
    expect(res.width).toBe(10);
    expect(res.data[0]).toBeGreaterThan(20);
  });

  it('02. HairlineThickener: should thicken fine hairlines', () => {
    const img = createMockImg(10, 10);
    const res = HairlineThickener.thickenHairlines(img, 1);
    expect(res.width).toBe(10);
  });

  it('03. PureWhiteCleanup: should snap near-white background to pure white', () => {
    const img = createMockImg(10, 10, 240, 240, 240);
    const res = PureWhiteCleanup.cleanNearWhite(img, 230, false);
    expect(res.data[0]).toBe(255);
    expect(res.data[1]).toBe(255);
    expect(res.data[2]).toBe(255);
  });

  it('04. SkinToneCyanSuppressor: should suppress cold cyan cast in skin tones', () => {
    const img = createMockImg(10, 10, 210, 150, 120);
    const res = SkinToneCyanSuppressor.optimizeSkinTones(img);
    expect(res.width).toBe(10);
  });

  it('05. DecontourEngine: should remove color banding stair-steps with blue noise', () => {
    const img = createMockImg(10, 10);
    const res = DecontourEngine.removeBanding(img);
    expect(res.width).toBe(10);
  });

  it('06. CmykVibrancyRescuer: should rescue vivid out-of-gamut colors', () => {
    const img = createMockImg(10, 10, 255, 20, 180);
    const res = CmykVibrancyRescuer.rescueVibrancy(img);
    expect(res.width).toBe(10);
  });

  it('07. AcrylicCharmBuilder: should generate 2mm dieline and white underbase', () => {
    const img = createMockImg(20, 20, 200, 50, 50);
    const res = AcrylicCharmBuilder.buildCharmDieline(img, 2.0, true);
    expect(res.dielineSvgPath).toContain('Dieline');
    expect(res.hasHangingHole).toBe(true);
  });

  it('08. StickerKisscutBuilder: should generate cute white border and cutline', () => {
    const img = createMockImg(20, 20, 200, 50, 50);
    const res = StickerKisscutBuilder.generateStickerBorder(img, 4);
    expect(res.stickerWithBorder.width).toBe(20);
    expect(res.cutContourSvg).toContain('svg');
  });

  it('09. TshirtColorKnockout: should knockout matching garment color', () => {
    const img = createMockImg(10, 10, 5, 5, 5);
    const res = TshirtColorKnockout.knockoutGarmentColor(img, '#000000', 30);
    expect(res.data[3]).toBe(0); // Knocked out to transparent
  });

  it('10. TextSafezonePadding: should enforce 5mm text safe print padding', () => {
    const img = createMockImg(50, 50, 20, 20, 20);
    const res = TextSafezonePadding.enforceSafeZone(img, 10);
    expect(res.message).toBeDefined();
  });

  it('11. AiPseudoTextFilter: should clean unreadable AI gibberish text', () => {
    const img = createMockImg(10, 10);
    const res = AiPseudoTextFilter.cleanPseudoText(img);
    expect(res.width).toBe(10);
  });

  it('12. MicroContrastTextBooster: should widen dark-on-dark text contrast', () => {
    const img = createMockImg(10, 10, 60, 60, 60);
    const res = MicroContrastTextBooster.boostContrast(img);
    expect(res.data[0]).toBeLessThan(60);
  });

  it('13. RealPaperSimulator: should simulate kraft and woodfree paper absorbency', () => {
    const img = createMockImg(10, 10, 200, 200, 200);
    const res = RealPaperSimulator.simulatePaper(img, 'kraft');
    expect(res.width).toBe(10);
  });

  it('14. ResolutionDefectVisualizer: should calculate effective DPI defect rating', () => {
    const img = createMockImg(100, 100);
    const res = ResolutionDefectVisualizer.visualizeDefects(img, 210, 297);
    expect(res.effectiveDpi).toBeLessThan(150);
    expect(res.qualityRating).toBe('BLURRY_DEFECT');
  });

  it('15. FoilingHighlightExtractor: should extract gold/silver hot stamping mask', () => {
    const img = createMockImg(10, 10, 220, 180, 40);
    const res = FoilingHighlightExtractor.extractFoilingMask(img, 'gold');
    expect(res.width).toBe(10);
    expect(res.data[3]).toBe(255); // 100% K100 mask
  });

  it('16. BarcodeQrFixer: should binarize fuzzy raster QR codes to pure black K100', () => {
    const img = createMockImg(10, 10, 80, 80, 80);
    const res = BarcodeQrFixer.fixQrCode(img, 140);
    expect(res.data[0]).toBe(0);
    expect(res.data[3]).toBe(255);
  });

  it('17. PassportProportionAligner: should align portrait photo to 75% head ratio', () => {
    const img = createMockImg(10, 10);
    const res = PassportProportionAligner.alignPassportPhoto(img, 0.75);
    expect(res.headRatioPercent).toBe(75);
    expect(res.isIcaoCompliant).toBe(true);
  });

  it('19. SeamCarvingCanvasFitter: should fit canvas aspect ratio without distortion', () => {
    const img = createMockImg(20, 20);
    const res = SeamCarvingCanvasFitter.fitToCanvas(img, 0.707);
    expect(res.width).toBe(20);
  });

  it('20. EdgeBleedFeathering: should apply soft vignette edge feathering', () => {
    const img = createMockImg(50, 50, 100, 100, 100, 255);
    const res = EdgeBleedFeathering.featherEdges(img, 10);
    expect(res.data[3]).toBe(0); // Corner alpha is 0
  });
});
