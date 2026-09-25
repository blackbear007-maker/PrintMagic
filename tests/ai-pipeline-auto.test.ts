import { describe, it, expect } from 'vitest';
import { HandShadowBalancer } from '../src/core/hand-shadow-balancer';
import { DEFAULT_PIPELINE_OPTIONS } from '../src/types';

describe('Automatic pre-press pipeline defaults and local steps', () => {
  const createMockImageData = (w: number, h: number, r = 200, g = 200, b = 200, a = 255): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('enables the automatic pre-press steps by default and leaves deshadow opt-in', () => {
    expect(DEFAULT_PIPELINE_OPTIONS.enableUpscale).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableSharpening).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableShadowLift).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableBleedExpand).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableAntiBanding).toBe(true);
    expect(DEFAULT_PIPELINE_OPTIONS.enableDeshadow).toBe(false);
  });

  it('should normalize non-uniform illumination gradient with HandShadowBalancer', () => {
    const img = createMockImageData(60, 60);
    // Create dark gradient shadow on left side
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 30; x++) {
        const idx = (y * 60 + x) * 4;
        img.data[idx] = 60; // shadow
        img.data[idx + 1] = 60;
        img.data[idx + 2] = 60;
      }
    }

    const deshadowed = HandShadowBalancer.deshadow(img, 0.8);
    expect(deshadowed.width).toBe(60);
    expect(deshadowed.height).toBe(60);
    // Shadowed pixels should be brightened
    const shadowIdx = (30 * 60 + 10) * 4;
    expect(deshadowed.data[shadowIdx]).toBeGreaterThan(60);
  });
});
