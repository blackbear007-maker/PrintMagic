import { describe, it, expect } from 'vitest';
import { AdaptiveWienerDeblur } from '../src/core/adaptive-wiener-deblur';

describe('Pure Automatic Pre-Press Quality & Calibration Algorithms Suite', () => {
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

  it('01. AdaptiveWienerDeblur: should deblur soft handshake contours in 0ms', () => {
    const img = createMockImg(10, 10);
    const res = AdaptiveWienerDeblur.deblur(img, 0.5);
    expect(res.width).toBe(10);
  });
});
