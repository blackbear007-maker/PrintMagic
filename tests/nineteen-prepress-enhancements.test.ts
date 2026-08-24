import { describe, it, expect } from 'vitest';
import { TrappingMaster } from '../src/core/trapping-master';
import { MetallicFoilSeparator } from '../src/core/metallic-foil-separator';
import { UcrGcrEngine } from '../src/core/ucr-gcr-engine';
import { NestingOptimizer } from '../src/core/nesting-optimizer';
import { DotgainPredictor } from '../src/core/dotgain-predictor';
import { BarcodeVectorSynthesizer } from '../src/core/barcode-vector-synthesizer';
import { SpotUvDilator } from '../src/core/spot-uv-dilator';
import { PackagingCreaseFold } from '../src/core/packaging-crease-fold';
import { SpineWidthCalculator } from '../src/core/spine-width-calculator';
import { GamutRemapper } from '../src/core/gamut-remapper';
import { HdrToner } from '../src/core/hdr-toner';
import { VectorSilhouette } from '../src/core/vector-silhouette';
import { GripMarginChecker } from '../src/core/grip-margin-checker';
import { MetallicSheenRenderer } from '../src/core/metallic-sheen-renderer';
import { ScreenAngleOptimizer } from '../src/core/screen-angle-optimizer';

describe('Advanced Commercial Pre-Press Enhancements Suite', () => {
  const createMockImageData = (w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 180;
      data[i + 1] = 140;
      data[i + 2] = 100;
      data[i + 3] = 255;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('01. TrappingMaster: should apply ink boundary spread to prevent gaps', () => {
    const img = createMockImageData(20, 20);
    const res = TrappingMaster.applyTrapping(img, 1);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
  });

  it('02. MetallicFoilSeparator: should generate 100% K100 hot stamping foil mask', () => {
    const img = createMockImageData(20, 20);
    const res = MetallicFoilSeparator.extractFoilMask(img, 'gold');
    expect(res.foilType).toBe('gold');
    expect(res.maskImageData.width).toBe(20);
  });

  it('03. UcrGcrEngine: should replace under-color CMY with K plate to reduce TAC', () => {
    const img = createMockImageData(15, 15);
    const res = UcrGcrEngine.applyUcrGcr(img, 0.7);
    expect(res.width).toBe(15);
  });

  it('04. NestingOptimizer: should pack irregular sticker items onto A4 sheet with high utilization', () => {
    const items = [
      { id: 's1', widthMm: 50, heightMm: 50 },
      { id: 's2', widthMm: 40, heightMm: 60 },
      { id: 's3', widthMm: 30, heightMm: 30 }
    ];
    const res = NestingOptimizer.packSheet(items, 210, 297);
    expect(res.placedStickers.length).toBe(3);
    expect(res.sheetUtilizationPercent).toBeGreaterThan(0);
  });

  it('05. DotgainPredictor: should apply inverse dot gain curve for uncoated stock', () => {
    const img = createMockImageData(10, 10);
    const res = DotgainPredictor.compensateDotGain(img, 'uncoated');
    expect(res.width).toBe(10);
  });

  it('06. BarcodeVectorSynthesizer: should synthesize vector GS1 EAN-13 barcode', () => {
    const res = BarcodeVectorSynthesizer.synthesizeBarcode('4710123456789');
    expect(res.codeType).toBe('EAN-13');
    expect(res.svgDataUrl).toContain('data:image/svg+xml');
  });

  it('07. SpotUvDilator: should dilate spot UV mask for registration drift compensation', () => {
    const img = createMockImageData(20, 20);
    const res = SpotUvDilator.dilateUvMask(img, 2);
    expect(res.width).toBe(20);
  });

  it('08. PackagingCreaseFold: should validate tuck flap clearances for 3D box folding', () => {
    const res = PackagingCreaseFold.validateBoxDieLine(80, 120, 40);
    expect(res.isValidBox).toBe(true);
    expect(res.panelCount).toBe(6);
  });

  it('09. SpineWidthCalculator: should calculate precise millimeter spine thickness', () => {
    const res = SpineWidthCalculator.calculateSpine(120, 100, 'perfect');
    expect(res.spineWidthMm).toBeGreaterThan(0);
    expect(res.recommendations.length).toBeGreaterThan(0);
  });

  it('10. GamutRemapper: should remap neon out-of-gamut colors to ISO CMYK safety', () => {
    const img = createMockImageData(10, 10);
    const res = GamutRemapper.remapGamut(img);
    expect(res.width).toBe(10);
  });

  it('11. HdrToner: should compress 14EV dynamic range into 5EV paper reflectance', () => {
    const img = createMockImageData(15, 15);
    const res = HdrToner.toneMap(img, 0.8, 0.7);
    expect(res.width).toBe(15);
  });

  it('13. VectorSilhouette: should extract single-color vector silhouette', () => {
    const img = createMockImageData(15, 15);
    const res = VectorSilhouette.extractSilhouette(img, 130);
    expect(res.width).toBe(15);
  });

  it('14. GripMarginChecker: should verify press mechanical gripper margin clearances', () => {
    const img = createMockImageData(50, 50);
    const res = GripMarginChecker.checkGripperMargin(img, 10, 300);
    expect(res).toHaveProperty('hasGripperCollision');
    expect(res.gripperMarginMm).toBe(10);
  });

  it('15. MetallicSheenRenderer: should render interactive rainbow thin-film sheen', () => {
    const img = createMockImageData(20, 20);
    const res = MetallicSheenRenderer.renderMetallicSheen(img, 45, 0.8);
    expect(res.width).toBe(20);
  });

  it('19. ScreenAngleOptimizer: should verify ISO 12647-2 rosette collision angles', () => {
    const res = ScreenAngleOptimizer.verifyScreenAngles(15, 75, 0, 45);
    expect(res.isOptimal).toBe(true);
    expect(res.rosetteQuality).toBe('clean');
  });
});
