import { describe, it, expect } from 'vitest';
import { RealPaperSimulator } from '../src/core/real-paper-simulator';
import { QrPreflightEnhancer } from '../src/core/qr-preflight-enhancer';

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

  it('RealPaperSimulator: should simulate woodfree and kraft physical substrate absorbency', () => {
    const img = createMockImageData(15, 15);
    const woodfree = RealPaperSimulator.simulatePaper(img, 'woodfree');
    const kraft = RealPaperSimulator.simulatePaper(img, 'kraft');
    expect(woodfree.width).toBe(15);
    expect(kraft.width).toBe(15);
  });

  it('QrPreflightEnhancer: should evaluate scan safety of QR codes', () => {
    const img = createMockImageData(30, 30);
    const report = QrPreflightEnhancer.evaluateQrCode(img, 300);
    expect(report).toHaveProperty('isScanSafe');
    expect(report).toHaveProperty('contrastRatioPercent');
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
