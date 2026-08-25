import { describe, it, expect } from 'vitest';
import { CanvasWrapMirror } from '../src/core/canvas-wrap-mirror';
import { FluorescentNeonExtractor } from '../src/core/fluorescent-neon-extractor';

describe('User-Facing Commercial Image Pre-Press Suite (Batch 2)', () => {
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

  it('01. CanvasWrapMirror: should extend 4 borders with mirror reflection', () => {
    const img = createMockImg(20, 20, 150, 120, 80);
    const res = CanvasWrapMirror.generateCanvasWrap(img, 10);
    expect(res.width).toBe(40);
    expect(res.height).toBe(40);
  });

  it('02. FluorescentNeonExtractor: should extract 5th neon spot color plate', () => {
    const img = createMockImg(10, 10, 240, 50, 180);
    const res = FluorescentNeonExtractor.extractNeonChannel(img, 'pink');
    expect(res.spotColorName).toContain('Pantone 806');
    expect(res.coveragePercent).toBeGreaterThan(0);
  });
});
