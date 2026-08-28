import { describe, it, expect } from 'vitest';
import { MoireDescreen, MAX_DESCREEN_INPUT_PIXELS } from '../src/core/moire-descreen';

function makeImageData(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 200; // deliberately non-255 alpha, to verify it passes through untouched
    }
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

/** Measures how much a fine checkerboard-style high-frequency signal remains in a plane. */
function highFrequencyEnergy(data: Uint8ClampedArray, width: number, height: number, channel: number): number {
  let energy = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const i0 = (y * width + x) * 4 + channel;
      const i1 = (y * width + x - 1) * 4 + channel;
      const diff = data[i0] - data[i1];
      energy += diff * diff;
    }
  }
  return energy / (width * height);
}

describe('MoireDescreen (FFT descreen filter, real port of 6o6o/fft-descreen, MIT)', () => {
  it('returns an output with the same dimensions as the input', () => {
    const img = makeImageData(64, 48, () => [128, 128, 128]);
    const result = MoireDescreen.apply(img);
    expect(result.width).toBe(64);
    expect(result.height).toBe(48);
    expect(result.data.length).toBe(64 * 48 * 4);
  });

  it('leaves the alpha channel completely untouched', () => {
    const img = makeImageData(32, 32, (x) => [x * 4, 100, 200]);
    const result = MoireDescreen.apply(img);
    for (let i = 3; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(200);
    }
  });

  it('works on non-power-of-2 dimensions (exercises the reflect-padding path)', () => {
    const img = makeImageData(100, 150, () => [50, 60, 70]);
    const result = MoireDescreen.apply(img);
    expect(result.width).toBe(100);
    expect(result.height).toBe(150);
  });

  it('throws a clear error for images over the size cap instead of silently hanging', () => {
    const side = Math.ceil(Math.sqrt(MAX_DESCREEN_INPUT_PIXELS)) + 50;
    const img = makeImageData(4, 4, () => [0, 0, 0]);
    // Fake an oversized ImageData without actually allocating the huge buffer.
    const fakeOversized = { width: side, height: side, data: new Uint8ClampedArray(4), colorSpace: 'srgb' } as unknown as ImageData;
    expect(() => MoireDescreen.apply(fakeOversized)).toThrow(/圖片過大/);
    expect(img).toBeTruthy(); // keep the unused var meaningful
  });

  it('measurably reduces a strong fine-pitch periodic (checkerboard) pattern', () => {
    const size = 128;
    // A 2px-period checkerboard is an extreme, unambiguous periodic signal — exactly the class of
    // pattern (regular halftone-like screening) this filter targets.
    const img = makeImageData(size, size, (x, y) => {
      const on = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0;
      const v = on ? 220 : 40;
      return [v, v, v];
    });

    const before = highFrequencyEnergy(img.data, size, size, 0);
    const result = MoireDescreen.apply(img, { threshold: 60 });
    const after = highFrequencyEnergy(result.data, size, size, 0);

    expect(before).toBeGreaterThan(1000); // sanity: the synthetic pattern really is high-frequency
    expect(after).toBeLessThan(before * 0.5); // real, substantial reduction, not a no-op
  });

  it('leaves a smooth low-frequency gradient close to unchanged', () => {
    const size = 128;
    const img = makeImageData(size, size, (x) => {
      const v = Math.round((x / size) * 255);
      return [v, v, v];
    });

    const result = MoireDescreen.apply(img);

    let maxDiff = 0;
    let sumDiff = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const diff = Math.abs(img.data[i] - result.data[i]);
      maxDiff = Math.max(maxDiff, diff);
      sumDiff += diff;
    }
    const meanDiff = sumDiff / (size * size);
    // A smooth gradient has essentially no energy in the frequency bands this filter targets, so
    // it should come back close to untouched — loose bounds since padding/edge handling and the
    // Gaussian-blurred mask edges still introduce some real, expected numerical drift.
    expect(meanDiff).toBeLessThan(10);
  });

  it('respects custom threshold/radius/middle options without throwing', () => {
    const img = makeImageData(64, 64, (x, y) => [(x * 3) % 255, (y * 5) % 255, 100]);
    const result = MoireDescreen.apply(img, { threshold: 80, radius: 4, middle: 3 });
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
  });
});
