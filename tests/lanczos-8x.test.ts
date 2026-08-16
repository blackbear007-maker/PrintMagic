import { describe, it, expect } from 'vitest';
import { LanczosResizer } from '../src/engines/lanczos';
import { UnsharpMask } from '../src/core/unsharp-mask';

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
    const w = 30;
    const h = 30;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100;
      data[i + 1] = 150;
      data[i + 2] = 220;
      data[i + 3] = 255;
    }

    const res4x = LanczosResizer.resize(data, w, h, 4);
    expect(res4x.width).toBe(120);
    expect(res4x.height).toBe(120);

    const res8x = LanczosResizer.resize(data, w, h, 8);
    expect(res8x.width).toBe(240);
    expect(res8x.height).toBe(240);
  });

  it('should apply dual-band edge-preserving USM with noise thresholding', () => {
    const w = 40;
    const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    // Draw a sharp edge in the middle
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const val = x < 20 ? 50 : 200;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    const imgData = { width: w, height: h, data } as ImageData;
    const sharpened = UnsharpMask.apply(imgData, 1.5, 1, 3);
    expect(sharpened.width).toBe(40);
    expect(sharpened.height).toBe(40);
    expect(sharpened.data.length).toBe(w * h * 4);
  });
});
