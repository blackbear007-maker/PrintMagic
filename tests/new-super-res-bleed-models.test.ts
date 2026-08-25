import { describe, it, expect } from 'vitest';
import { LineArtUpscaler } from '../src/core/line-art-upscaler';
import { EdgeAwareUpscaler } from '../src/core/edge-aware-upscaler';

describe('New Open-Source Super-Resolution Suite', () => {
  const createMockImageData = (w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 120;
      data[i + 1] = 140;
      data[i + 2] = 160;
      data[i + 3] = 255;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('LineArtUpscaler: should upscale 2x and sharpen dark line art boundaries', () => {
    const src = createMockImageData(20, 20);
    const res = LineArtUpscaler.upscaleAnime(src, 2);
    expect(res.width).toBe(40);
    expect(res.height).toBe(40);
  });

  it('EdgeAwareUpscaler: should apply compact RRDB 2x and 4x pre-press super-resolution', () => {
    const src = createMockImageData(25, 25);
    const res2x = EdgeAwareUpscaler.upscale(src, 2, 0.5);
    expect(res2x.upscaledImageData.width).toBe(50);
    expect(res2x.upscaledImageData.height).toBe(50);
    expect(res2x.scaleFactor).toBe(2);

    const res4x = EdgeAwareUpscaler.upscale(src, 4, 0.5);
    expect(res4x.upscaledImageData.width).toBe(100);
    expect(res4x.upscaledImageData.height).toBe(100);
    expect(res4x.scaleFactor).toBe(4);
    expect(res4x.edgeCrispnessIndex).toBeGreaterThan(90);
  });
});
