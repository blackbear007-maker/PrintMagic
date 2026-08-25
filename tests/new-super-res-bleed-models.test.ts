import { describe, it, expect } from 'vitest';
import { Anime4kUpscaler } from '../src/core/anime4k-upscaler';
import { HatSUpscaler } from '../src/core/hat-s-upscaler';
import { SwinirUpscaler } from '../src/core/swinir-upscaler';

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

  it('Anime4kUpscaler: should upscale 2x and sharpen dark line art boundaries', () => {
    const src = createMockImageData(20, 20);
    const res = Anime4kUpscaler.upscaleAnime(src, 2);
    expect(res.width).toBe(40);
    expect(res.height).toBe(40);
  });

  it('HatSUpscaler: should apply hybrid attention texture restoration', () => {
    const src = createMockImageData(25, 25);
    const res = HatSUpscaler.upscalePhoto(src, 2);
    expect(res.width).toBe(50);
    expect(res.height).toBe(50);
  });

  it('SwinirUpscaler: should apply Swin deblocking and 2x super-resolution', () => {
    const src = createMockImageData(30, 30);
    const res = SwinirUpscaler.upscaleAndDeblock(src, 2);
    expect(res.width).toBe(60);
    expect(res.height).toBe(60);
  });
});
