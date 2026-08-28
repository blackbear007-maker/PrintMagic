import { describe, it, expect, beforeAll } from 'vitest';
import { MoireRiskPredictor } from '../src/core/moire-risk-predictor';

beforeAll(() => {
  if (typeof global.ImageData === 'undefined') {
    // @ts-ignore
    global.ImageData = class {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, maybeHeight?: number) {
        if (typeof dataOrWidth === 'number') {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        } else {
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = maybeHeight || 0;
        }
      }
    } as any;
  }
});

describe('MoireRiskPredictor.moirePeriod (Amidror/Hersch/Ostromoukhov formula)', () => {
  it('should predict an infinite (unbounded) period for two identical, perfectly aligned gratings — the "singular" worst case', () => {
    const period = MoireRiskPredictor.moirePeriod(10, 0, 10, 0);
    expect(period).toBe(Infinity);
  });

  it('should match the classical two-grating beat formula T1*T2/|T1-T2| at zero angle difference', () => {
    const period = MoireRiskPredictor.moirePeriod(10, 0, 11, 0);
    expect(period).toBeCloseTo((10 * 11) / 1, 5);
  });

  it('should match T/sqrt(2) for two equal-period gratings crossed at 90 degrees', () => {
    const period = MoireRiskPredictor.moirePeriod(10, 0, 10, 90);
    expect(period).toBeCloseTo(10 / Math.sqrt(2), 5);
  });

  it('should be symmetric under swapping the two gratings', () => {
    const a = MoireRiskPredictor.moirePeriod(12, 20, 9, 55);
    const b = MoireRiskPredictor.moirePeriod(9, 55, 12, 20);
    expect(a).toBeCloseTo(b, 8);
  });
});

describe('MoireRiskPredictor.detectDominantPeriodicity', () => {
  it('should detect an 8px-period vertical stripe pattern at ~0 degrees', () => {
    const size = 32;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const val = (Math.floor(x / 4) % 2 === 0) ? 220 : 40; // period-8 stripes along x
        const idx = (y * size + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    // @ts-ignore
    const img = { data, width: size, height: size } as ImageData;

    const result = MoireRiskPredictor.detectDominantPeriodicity(img);
    expect(result).not.toBeNull();
    expect(result!.periodPx).toBeCloseTo(8, 0);
    expect(Math.min(result!.angleDeg, 180 - result!.angleDeg)).toBeLessThan(10);
  });

  it('should correctly rescale the detected period back to source pixels on a large image that triggers internal downsampling', () => {
    // Larger than WORKING_MAX_DIMENSION (768) on both sides, so this exercises the box-downsample
    // + period-rescale path, not just scale=1 passthrough like the 32px test above.
    const size = 1600;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const val = (Math.floor(x / 16) % 2 === 0) ? 220 : 40; // period-32 stripes along x
        const idx = (y * size + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    // @ts-ignore
    const img = { data, width: size, height: size } as ImageData;

    const result = MoireRiskPredictor.detectDominantPeriodicity(img);
    expect(result).not.toBeNull();
    // Allow a wider tolerance than the small-image test — downsampling to a working resolution
    // quantizes the detectable period to the nearest working-grid frequency bin, then rescaling
    // that back up amplifies the quantization step, so exact-integer closeness isn't expected.
    expect(result!.periodPx).toBeGreaterThan(26);
    expect(result!.periodPx).toBeLessThan(38);
    expect(Math.min(result!.angleDeg, 180 - result!.angleDeg)).toBeLessThan(10);
  });

  it('should report no significant periodicity for a smooth low-frequency gradient', () => {
    // A larger image than the stripe-pattern test above, deliberately: a plain gradient's energy
    // is genuinely spread across many low frequency bins near DC (it's a real, broadband signal,
    // not silence) — a small, coarse-resolution FFT compresses "near DC" and "a real fine
    // pattern" into just a handful of bins with too little room to tell them apart. A more
    // realistic image size gives the same physical distinction the real use case relies on: a
    // photo's lighting/skin/sky gradients sit very close to DC, while an actual repeating
    // pattern (fabric weave, halftone dots) sits far out — this is that separation, at a size
    // where it actually has room to show up.
    const size = 128;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const val = Math.round(((x + y) / (2 * size)) * 255);
        const idx = (y * size + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    // @ts-ignore
    const img = { data, width: size, height: size } as ImageData;
    const result = MoireRiskPredictor.detectDominantPeriodicity(img);
    expect(result).toBeNull();
  });
});

describe('MoireRiskPredictor.assess', () => {
  it('should flag a screen ruling whose period nearly matches the artwork pattern as higher risk than a clearly different one', () => {
    // 8px-period stripes at a plausible print size. At printDpi=800, an 8px period is a fine
    // pattern (100 LPI-equivalent) — close to a 100 LPI screen, further from 200 LPI.
    const size = 64;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const val = (Math.floor(x / 4) % 2 === 0) ? 220 : 40;
        const idx = (y * size + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    // @ts-ignore
    const img = { data, width: size, height: size } as ImageData;

    const { detected, assessments } = MoireRiskPredictor.assess(img, 800, [100, 200]);
    expect(detected).not.toBeNull();
    expect(assessments.length).toBe(2);

    const near = assessments.find((a) => a.lpi === 100)!;
    const far = assessments.find((a) => a.lpi === 200)!;
    expect(near.predictedMoirePeriodMm).toBeGreaterThan(far.predictedMoirePeriodMm);
  });

  it('should return low-risk assessments with no thrown error when no periodicity is detected', () => {
    const size = 32;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
    // @ts-ignore
    const img = { data, width: size, height: size } as ImageData;
    const { detected, assessments } = MoireRiskPredictor.assess(img, 300, [133, 175]);
    expect(detected).toBeNull();
    for (const a of assessments) expect(a.riskLevel).toBe('low');
  });
});
