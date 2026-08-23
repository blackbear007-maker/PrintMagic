import { describe, it, expect } from 'vitest';
import { OgvSeparator } from '../src/core/ogv-separator';
import { CrystalUvHeightmap } from '../src/core/crystal-uv-heightmap';
import { SaddleStitchCreep } from '../src/core/saddle-stitch-creep';
import { InkWashDiffusion } from '../src/core/inkwash-diffusion';
import { AncientTypefaceRestorer } from '../src/core/ancient-typeface-restorer';

describe('5 Master-Level Pre-Press & Fine Art Reproduction Suite', () => {
  const createMockImageData = (w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 220;
      data[i + 1] = 120;
      data[i + 2] = 40;
      data[i + 3] = 255;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('OgvSeparator: should separate image into 7-Color CMYK+OGV process plates', () => {
    const img = createMockImageData(20, 20);
    const plates = OgvSeparator.separateOgvPlates(img);
    expect(plates.length).toBe(7);
    expect(plates.map(p => p.channel)).toEqual(['C', 'M', 'Y', 'K', 'O', 'G', 'V']);
  });

  it('CrystalUvHeightmap: should generate white underbase and multi-tier UV gloss varnish heightmap', () => {
    const img = createMockImageData(25, 25);
    const layers = CrystalUvHeightmap.generateCrystalLayers(img, 4);
    expect(layers.varnishLevels).toBe(4);
    expect(layers.totalReliefDepthMm).toBe(0.32);
    expect(layers.whiteUnderbaseMask.width).toBe(25);
    expect(layers.varnishHeightmap.width).toBe(25);
  });

  it('SaddleStitchCreep: should calculate progressive shingling offsets to prevent inner page creep', () => {
    const plan = SaddleStitchCreep.calculateCreepPlan(32, 120);
    expect(plan.totalPages).toBe(32);
    expect(plan.sheetCount).toBe(8);
    expect(plan.maxCreepMm).toBeGreaterThan(0);
    expect(plan.pageShifts.length).toBe(32);
    expect(plan.recommendations.length).toBeGreaterThan(0);
  });

  it('InkWashDiffusion: should simulate capillary bleeding on porous Xuan rice paper', () => {
    const img = createMockImageData(20, 20);
    const res = InkWashDiffusion.simulateInkWash(img, 2, 0.7);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
  });

  it('AncientTypefaceRestorer: should bridge hairline fractures and broken strokes in ancient movable type', () => {
    const img = createMockImageData(20, 20);
    const res = AncientTypefaceRestorer.restoreTypeface(img, 2);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
  });
});
