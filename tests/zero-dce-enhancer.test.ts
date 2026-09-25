import { describe, it, expect } from 'vitest';
import { ZeroDceEnhancer } from '../src/core/zero-dce-enhancer';

// Local fallback for low-light scenes (FreeLowlightClient uses it when the Retinexformer service is
// down or in local mode). 2026-09-26: replaces sota-ai-suite's check, which ran on a uniform image and
// asserted a hard-coded noiseAmplificationRatio of 1.02 (the real absolute noise gain is ~2.8x).
describe('ZeroDceEnhancer (local low-light curve)', () => {
  let seed = 1;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const noisy = (base: number, spread: number, w = 64, h = 64): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = base + Math.round((rnd() - 0.5) * spread);
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
      data[i * 4 + 3] = 200;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };
  const stats = (img: ImageData) => {
    let s = 0, s2 = 0;
    const n = img.width * img.height;
    for (let i = 0; i < n; i++) {
      s += img.data[i * 4];
      s2 += img.data[i * 4] ** 2;
    }
    const mean = s / n;
    return { mean, std: Math.sqrt(s2 / n - mean * mean) };
  };

  it('brightens a dark, noisy image without making the noise worse relative to the signal', () => {
    const src = noisy(30, 12);
    const before = stats(src);
    const result = ZeroDceEnhancer.enhance(src);
    const after = stats(result.enhancedImageData);

    expect(after.mean).toBeGreaterThan(before.mean * 2);
    expect(result.meanLuminanceAfter).toBeGreaterThan(result.meanLuminanceBefore);
    // Absolute noise grows with the brightening; relative noise (std / mean) must not.
    expect(after.std / after.mean).toBeLessThanOrEqual(before.std / before.mean);
    // Same size, alpha untouched.
    expect(result.enhancedImageData.width).toBe(64);
    expect(result.enhancedImageData.data[3]).toBe(200);
  });
});
