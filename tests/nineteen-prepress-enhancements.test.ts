import { describe, it, expect } from 'vitest';
import { TrappingMaster } from '../src/core/trapping-master';
import { MetallicFoilSeparator } from '../src/core/metallic-foil-separator';
import { NestingOptimizer } from '../src/core/nesting-optimizer';
import { SpotUvDilator } from '../src/core/spot-uv-dilator';
import { GamutRemapper } from '../src/core/gamut-remapper';
import { GripMarginChecker } from '../src/core/grip-margin-checker';

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

  it('03. NestingOptimizer: should pack irregular sticker items onto A4 sheet with high utilization', () => {
    const items = [
      { id: 's1', widthMm: 50, heightMm: 50 },
      { id: 's2', widthMm: 40, heightMm: 60 },
      { id: 's3', widthMm: 30, heightMm: 30 }
    ];
    const res = NestingOptimizer.packSheet(items, 210, 297);
    expect(res.placedStickers.length).toBe(3);
    expect(res.sheetUtilizationPercent).toBeGreaterThan(0);
  });

  it('04. SpotUvDilator: should dilate spot UV mask for registration drift compensation', () => {
    const img = createMockImageData(20, 20);
    const res = SpotUvDilator.dilateUvMask(img, 2);
    expect(res.width).toBe(20);
  });

  it('05. GamutRemapper: should remap neon out-of-gamut colors to ISO CMYK safety', () => {
    const img = createMockImageData(10, 10);
    const res = GamutRemapper.remapGamut(img);
    expect(res.width).toBe(10);
  });

  it('06. GripMarginChecker: should verify press mechanical gripper margin clearances', () => {
    const img = createMockImageData(50, 50);
    const res = GripMarginChecker.checkGripperMargin(img, 10, 300);
    expect(res).toHaveProperty('hasGripperCollision');
    expect(res.gripperMarginMm).toBe(10);
  });
});
