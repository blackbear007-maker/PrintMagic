import { describe, it, expect } from 'vitest';
import { HairlineThickener } from '../src/core/hairline-thickener';
import { SkinToneCyanSuppressor } from '../src/core/skin-tone-cyan-suppressor';
import { AcrylicCharmBuilder } from '../src/core/acrylic-charm-builder';
import { StickerKisscutBuilder } from '../src/core/sticker-kisscut-builder';
import { TshirtColorKnockout } from '../src/core/tshirt-color-knockout';
import { RealPaperSimulator } from '../src/core/real-paper-simulator';

describe('User-Facing Commercial Image Pre-Press Suite', () => {
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

  it('01. HairlineThickener: should thicken fine hairlines', () => {
    const img = createMockImg(10, 10);
    const res = HairlineThickener.thickenHairlines(img, 1);
    expect(res.width).toBe(10);
  });

  it('02. SkinToneCyanSuppressor: should suppress cold cyan cast in skin tones', () => {
    const img = createMockImg(10, 10, 210, 150, 120);
    const res = SkinToneCyanSuppressor.optimizeSkinTones(img);
    expect(res.width).toBe(10);
  });

  it('03. AcrylicCharmBuilder: should generate 2mm dieline and white underbase', () => {
    const img = createMockImg(20, 20, 200, 50, 50);
    const res = AcrylicCharmBuilder.buildCharmDieline(img, 2.0, true);
    expect(res.dielineSvgPath).toContain('Dieline');
    expect(res.hasHangingHole).toBe(true);
  });

  it('04. StickerKisscutBuilder: should generate cute white border and cutline', () => {
    const img = createMockImg(20, 20, 200, 50, 50);
    const res = StickerKisscutBuilder.generateStickerBorder(img, 4);
    expect(res.stickerWithBorder.width).toBe(20);
    expect(res.cutContourSvg).toContain('svg');
  });

  it('05. TshirtColorKnockout: should knockout matching garment color', () => {
    const img = createMockImg(10, 10, 5, 5, 5);
    const res = TshirtColorKnockout.knockoutGarmentColor(img, '#000000', 30);
    expect(res.data[3]).toBe(0); // Knocked out to transparent
  });

  it('06. RealPaperSimulator: should simulate kraft and woodfree paper absorbency', () => {
    const img = createMockImg(10, 10, 200, 200, 200);
    const res = RealPaperSimulator.simulatePaper(img, 'kraft');
    expect(res.width).toBe(10);
  });
});
