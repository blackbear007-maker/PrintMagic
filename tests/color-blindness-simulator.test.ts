import { describe, it, expect, beforeAll } from 'vitest';
import { ColorBlindnessSimulator } from '../src/core/color-blindness-simulator';

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

function solidImage(r: number, g: number, b: number, w = 4, h = 4): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  // @ts-ignore
  return { data, width: w, height: h } as ImageData;
}

function pixelDistance(data: Uint8ClampedArray, idxA: number, idxB: number): number {
  const dr = data[idxA] - data[idxB];
  const dg = data[idxA + 1] - data[idxB + 1];
  const db = data[idxA + 2] - data[idxB + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

describe('ColorBlindnessSimulator', () => {
  it('should preserve dimensions and alpha', () => {
    const img = solidImage(200, 50, 50, 5, 3);
    const out = ColorBlindnessSimulator.simulate(img, 'deuteranopia');
    expect(out.width).toBe(5);
    expect(out.height).toBe(3);
    expect(out.data[3]).toBe(255);
  });

  it('should leave pure white and pure black essentially unchanged (on the achromatic axis)', () => {
    const white = solidImage(255, 255, 255, 2, 2);
    const black = solidImage(0, 0, 0, 2, 2);
    for (const type of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      const outW = ColorBlindnessSimulator.simulate(white, type);
      const outB = ColorBlindnessSimulator.simulate(black, type);
      expect(outW.data[0]).toBeGreaterThan(250);
      expect(outW.data[1]).toBeGreaterThan(250);
      expect(outW.data[2]).toBeGreaterThan(250);
      expect(outB.data[0]).toBeLessThan(5);
      expect(outB.data[1]).toBeLessThan(5);
      expect(outB.data[2]).toBeLessThan(5);
    }
  });

  it('should collapse red/green distinguishability much more under deuteranopia/protanopia than tritanopia', () => {
    // A classic red/green pair that's a known real-world CVD confusion case.
    const redData = new Uint8ClampedArray([200, 60, 60, 255]);
    const greenData = new Uint8ClampedArray([90, 160, 60, 255]);
    // @ts-ignore
    const redImg = { data: redData, width: 1, height: 1 } as ImageData;
    // @ts-ignore
    const greenImg = { data: greenData, width: 1, height: 1 } as ImageData;

    const normalDistance = pixelDistance(new Uint8ClampedArray([...redData, ...greenData]), 0, 4);

    const redDeutan = ColorBlindnessSimulator.simulate(redImg, 'deuteranopia');
    const greenDeutan = ColorBlindnessSimulator.simulate(greenImg, 'deuteranopia');
    const deutanDistance = pixelDistance(
      new Uint8ClampedArray([...redDeutan.data, ...greenDeutan.data]), 0, 4
    );

    const redTritan = ColorBlindnessSimulator.simulate(redImg, 'tritanopia');
    const greenTritan = ColorBlindnessSimulator.simulate(greenImg, 'tritanopia');
    const tritanDistance = pixelDistance(
      new Uint8ClampedArray([...redTritan.data, ...greenTritan.data]), 0, 4
    );

    expect(deutanDistance).toBeLessThan(normalDistance);
    // Tritanopia (blue-yellow deficiency) should preserve this red/green pair much better
    // than deuteranopia (red-green deficiency) — this is the whole physiological point.
    expect(tritanDistance).toBeGreaterThan(deutanDistance);
  });

  it('severity=0 should be a no-op and severity=1 should equal the full matrix result', () => {
    const img = solidImage(220, 40, 180, 2, 2);
    const zero = ColorBlindnessSimulator.simulate(img, 'protanopia', 0);
    const full = ColorBlindnessSimulator.simulate(img, 'protanopia', 1);
    expect(zero.data[0]).toBe(220);
    expect(zero.data[1]).toBe(40);
    expect(zero.data[2]).toBe(180);
    expect(full.data[0]).not.toBe(220);
  });

  it('assessRisk should return all three CVD types with a risk level and flag a red/green chart as risky', () => {
    // Half red, half green — a red/green status-color chart pattern.
    const w = 10, h = 10;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const isRed = x < w / 2;
        data[idx] = isRed ? 210 : 70;
        data[idx + 1] = isRed ? 60 : 170;
        data[idx + 2] = 60;
        data[idx + 3] = 255;
      }
    }
    // @ts-ignore
    const img = { data, width: w, height: h } as ImageData;
    const results = ColorBlindnessSimulator.assessRisk(img);

    expect(results.length).toBe(3);
    expect(results.map((r) => r.type).sort()).toEqual(['deuteranopia', 'protanopia', 'tritanopia'].sort());
    for (const r of results) {
      expect(['low', 'moderate', 'high']).toContain(r.riskLevel);
      expect(r.meanColorLossRatio).toBeGreaterThanOrEqual(0);
    }
    const deutan = results.find((r) => r.type === 'deuteranopia')!;
    expect(deutan.riskLevel).not.toBe('low');
  });
});
