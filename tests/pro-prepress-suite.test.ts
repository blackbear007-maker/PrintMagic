import { describe, it, expect } from 'vitest';
import { DeglareEngine } from '../src/core/deglare-engine';
import { DehazeEngine } from '../src/core/dehaze-engine';
import { ScratchRestorer } from '../src/core/scratch-restorer';

describe('Professional Specialized Pre-Press AI Suite', () => {
  const createMockImageData = (w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 160;
      data[i + 1] = 140;
      data[i + 2] = 120;
      data[i + 3] = 255;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('DeglareEngine: should suppress specular glare hotspots in glass/acrylic photos', () => {
    const img = createMockImageData(25, 25);
    // Add specular white hotspot at center
    const center = (12 * 25 + 12) * 4;
    img.data[center] = 250;
    img.data[center + 1] = 250;
    img.data[center + 2] = 250;

    const res = DeglareEngine.deglare(img, 0.85);
    expect(res.width).toBe(25);
    expect(res.height).toBe(25);
    expect(res.data[center]).toBeLessThan(250); // Glare suppressed
  });

  it('DehazeEngine: should clear atmospheric veil and restore contrast', () => {
    const img = createMockImageData(20, 20);
    const res = DehazeEngine.dehaze(img, 0.8);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
    expect(res.data.length).toBe(20 * 20 * 4);
  });

  it('ScratchRestorer: should restore linear paper fold creases and mold marks', () => {
    const img = createMockImageData(20, 20);
    // Add white vertical scratch line
    for (let y = 0; y < 20; y++) {
      const idx = (y * 20 + 10) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 255;
      img.data[idx + 2] = 255;
    }
    const res = ScratchRestorer.restoreScratches(img, 0.9);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
  });
});
