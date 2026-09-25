import { describe, it, expect } from 'vitest';
import { LineArtUpscaler } from '../src/core/line-art-upscaler';
import { EdgeAwareUpscaler } from '../src/core/edge-aware-upscaler';

describe('New Open-Source Super-Resolution Suite', () => {
  // 2026-09-26: these two run in production (anime scenes / the local upscale fallback). The old tests fed
  // a uniform colour and checked only dimensions plus a constant "crispness index", so an all-zero image
  // of the right size passed. Now: an edge / a line, and what each algorithm is supposed to do to it.
  const striped = (w: number, h: number, f: (x: number) => number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = f(i % w);
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };
  const row = (img: ImageData, y: number) => Array.from({ length: img.width }, (_, x) => img.data[(y * img.width + x) * 4]);

  it('LineArtUpscaler: upscales 2x, keeps flat colour and darkens ink lines beyond plain bilinear', () => {
    const src = striped(20, 6, (x) => (x === 9 || x === 10 ? 20 : 230)); // 2px dark line on light paper
    const res = LineArtUpscaler.upscaleAnime(src, 2);
    expect(res.width).toBe(40);
    expect(res.height).toBe(12);

    const r = row(res, 5);
    expect(r[2]).toBe(230);
    expect(r[37]).toBe(230);
    // Line core (dst 19-20) at least as dark as the source line; shoulders (dst 18/21) darker than the
    // 72.5 plain bilinear gives there; symmetric about the line.
    expect(Math.max(r[19], r[20])).toBeLessThanOrEqual(20);
    expect(r[18]).toBeLessThan(72);
    expect(r[21]).toBe(r[18]);
  });

  it('EdgeAwareUpscaler: keeps flat areas and makes an edge steeper than plain bilinear, at 2x and 4x', () => {
    const src = striped(20, 6, (x) => (x < 10 ? 40 : 200));
    const res2x = EdgeAwareUpscaler.upscale(src, 2, 0.5);
    expect(res2x.upscaledImageData.width).toBe(40);
    expect(res2x.upscaledImageData.height).toBe(12);
    expect(res2x.scaleFactor).toBe(2);

    const r = row(res2x.upscaledImageData, 5);
    expect(r.slice(0, 18).every((v) => v === 40)).toBe(true);
    expect(r.slice(22).every((v) => v === 200)).toBe(true);
    // Plain bilinear gives 80 / 160 at the two transition pixels; the edge boost pushes them apart.
    expect(r[19]).toBeLessThan(80);
    expect(r[20]).toBeGreaterThan(160);
    expect(r.every((v, i) => i === 0 || v >= r[i - 1])).toBe(true); // no ringing / reversal

    const res4x = EdgeAwareUpscaler.upscale(src, 4, 0.5);
    expect(res4x.upscaledImageData.width).toBe(80);
    expect(res4x.upscaledImageData.height).toBe(24);
    expect(res4x.scaleFactor).toBe(4);
    const r4 = row(res4x.upscaledImageData, 10);
    expect(Math.min(...r4)).toBe(40);
    expect(Math.max(...r4)).toBe(200);
  });
});
