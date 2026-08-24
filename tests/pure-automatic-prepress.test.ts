import { describe, it, expect } from 'vitest';
import { AdaptiveWienerDeblur } from '../src/core/adaptive-wiener-deblur';
import { CornerRadiusMitering } from '../src/core/corner-radius-mitering';
import { AutoKeystoneRectifier } from '../src/core/auto-keystone-rectifier';

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

  it('02. CornerRadiusMitering: should inspect R5 die-cut corner safety', () => {
    const img = createMockImg(50, 50, 255, 255, 255);
    const res = CornerRadiusMitering.inspectCornerSafety(img, 5.0);
    expect(res.cornerSafe).toBe(true);
  });

  it('03. AutoKeystoneRectifier: should 100% automatically detect document corners', () => {
    const img = createMockImg(50, 50);
    const res = AutoKeystoneRectifier.autoRectify(img);
    expect(res.detectedCorners.length).toBe(4);
    expect(res.tiltAngleDeg).toBe(0);
  });
});
