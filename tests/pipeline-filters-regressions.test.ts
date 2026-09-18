import { describe, it, expect } from 'vitest';
import { createImageData } from '../src/core/image-data-factory';
import { SharpenDeblurFilter } from '../src/core/sharpen-deblur-filter';
import { LineArtUpscaler } from '../src/core/line-art-upscaler';
import { HandShadowBalancer } from '../src/core/hand-shadow-balancer';
import { UnsharpMask } from '../src/core/unsharp-mask';

function solid(w: number, h: number, v: number, a = 255): ImageData {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = a; }
  return createImageData(d, w, h);
}

describe('pipeline filter regressions', () => {
  it('deblur keeps flat tone and writes every pixel (no transparent black border)', () => {
    const out = SharpenDeblurFilter.deblur(solid(10, 10, 100));
    for (let i = 0; i < out.data.length; i += 4) {
      expect(Math.abs(out.data[i] - 100)).toBeLessThanOrEqual(1);
      expect(out.data[i + 3]).toBe(255);
    }
  });

  it('line-art scale 1 preserves size and transparency', () => {
    const src = solid(8, 8, 200, 0);
    const out = LineArtUpscaler.upscaleAnime(src, 1);
    expect(out.width).toBe(8);
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(0);
  });

  it('deshadow does not relight a uniform narrow dark image', () => {
    const out = HandShadowBalancer.deshadow(solid(10, 40, 40), 0.7);
    for (let i = 0; i < out.data.length; i += 4) expect(out.data[i]).toBe(40);
  });

  it('USM leaves a constant image unchanged at the borders', () => {
    const out = UnsharpMask.apply(solid(32, 32, 128));
    for (let i = 0; i < out.data.length; i += 4) expect(Math.abs(out.data[i] - 128)).toBeLessThanOrEqual(1);
  });
});
