import { describe, it, expect } from 'vitest';
import { LineartExtractor } from '../src/core/lineart-extractor';
import { PaperTextureEngine } from '../src/core/paper-texture-engine';
import { RisoSeparator } from '../src/core/riso-separator';
import { QrPreflightEnhancer } from '../src/core/qr-preflight-enhancer';
import { BrailleBuilder } from '../src/core/braille-builder';

describe('Special Finishes & Artisanal Pre-Press Suite', () => {
  const createMockImageData = (w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 160;
      data[i + 1] = 120;
      data[i + 2] = 80;
      data[i + 3] = 255;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('LineartExtractor: should extract clean binary line art', () => {
    const img = createMockImageData(20, 20);
    const res = LineartExtractor.extractLineart(img, 1.0, 0.9);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
    expect([0, 255]).toContain(res.data[0]); // Binary 0 or 255
  });

  it('PaperTextureEngine: should apply 3D Linen and Kraft procedural textures', () => {
    const img = createMockImageData(15, 15);
    const linen = PaperTextureEngine.applyTexture(img, 'linen', 0.5);
    const kraft = PaperTextureEngine.applyTexture(img, 'kraft', 0.5);
    expect(linen.width).toBe(15);
    expect(kraft.width).toBe(15);
  });

  it('RisoSeparator: should separate artwork into discrete spot color plates', () => {
    const img = createMockImageData(25, 25);
    const plates = RisoSeparator.separatePlates(img, 3);
    expect(plates.length).toBe(3);
    expect(plates[0].inkName).toContain('Black');
    expect(plates[1].inkName).toContain('Pink');
    expect(plates[0].plateImageData.width).toBe(25);
  });

  it('QrPreflightEnhancer: should evaluate scan safety of QR codes', () => {
    const img = createMockImageData(30, 30);
    const report = QrPreflightEnhancer.evaluateQrCode(img, 300);
    expect(report).toHaveProperty('isScanSafe');
    expect(report).toHaveProperty('contrastRatioPercent');
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('BrailleBuilder: should translate text to Grade-1 Braille dots and generate embossing mask', () => {
    const translated = BrailleBuilder.translateText('hello 123');
    expect(translated.length).toBe(9);

    const mask = BrailleBuilder.generateEmbossingMask('VIP PASS', 600, 150);
    expect(mask.brailleText.length).toBe(8);
    expect(mask.embossingMaskDataUrl).toContain('data:image/svg+xml');
  });
});
