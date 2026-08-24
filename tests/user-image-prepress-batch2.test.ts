import { describe, it, expect } from 'vitest';
import { CanvasWrapMirror } from '../src/core/canvas-wrap-mirror';
import { PhotoFrameMat } from '../src/core/photo-frame-mat';
import { GridSplitterMultiPanel } from '../src/core/grid-splitter-multi-panel';
import { HolographicFoilMasker } from '../src/core/holographic-foil-masker';
import { FoldedGreetingCard } from '../src/core/folded-greeting-card';
import { FluorescentNeonExtractor } from '../src/core/fluorescent-neon-extractor';
import { WatermarkStampRemover } from '../src/core/watermark-stamp-remover';
import { BusinessCardSmartAligner } from '../src/core/business-card-smart-aligner';

describe('User-Facing Image Pre-Press Optimization Suite (Batch 2)', () => {
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

  it('09. FluorescentNeonExtractor: should extract 5th neon spot color plate', () => {
    const img = createMockImg(10, 10, 240, 50, 180);
    const res = FluorescentNeonExtractor.extractNeonChannel(img, 'pink');
    expect(res.spotColorName).toContain('Pantone 806');
    expect(res.coveragePercent).toBeGreaterThan(0);
  });

  it('14. WatermarkStampRemover: should inpaint date stamps and watermarks', () => {
    const img = createMockImg(10, 10, 245, 100, 100);
    const res = WatermarkStampRemover.removeWatermark(img, 200);
    expect(res.width).toBe(10);
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
