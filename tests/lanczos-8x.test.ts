import { describe, it, expect } from 'vitest';
import { LanczosResizer } from '../src/engines/lanczos';

describe('Lanczos Super-Resolution & USM Upgraded Engine', () => {
  it('should upscale image by 2x with zero dimension anomaly', () => {
    const w = 50;
    const h = 50;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 200;
      data[i + 2] = 50;
      data[i + 3] = 255;
    }

    const res2x = LanczosResizer.resize(data, w, h, 2);
    expect(res2x.width).toBe(100);
    expect(res2x.height).toBe(100);
    expect(res2x.data.length).toBe(100 * 100 * 4);
  });

  it('should support progressive pyramid upscale by 4x and 8x without halo ringing', () => {
    // 2026-09-26: was a uniform colour with dimension checks only, so ringing could never show. A step
    // edge is where Lanczos lobes overshoot; the result must stay inside the input range and rise
    // from the dark side to the light side.
    const w = 16;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = i % w < 8 ? 40 : 200;
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }

    for (const scale of [4, 8]) {
      const res = LanczosResizer.resize(data, w, h, scale);
      expect(res.width).toBe(w * scale);
      expect(res.height).toBe(h * scale);
      const row = Array.from({ length: res.width }, (_, x) => res.data[(2 * res.width + x) * 4]);
      expect(Math.min(...row)).toBeGreaterThanOrEqual(40);
      expect(Math.max(...row)).toBeLessThanOrEqual(200);
      expect(row[0]).toBe(40);
      expect(row[res.width - 1]).toBe(200);
      expect(row[res.width / 2 + scale]).toBeGreaterThan(row[res.width / 2 - scale - 1]);
    }
  });
});
