import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DielineEngine } from '../src/core/dieline-engine';

describe('DielineEngine (White Ink Choke & 2mm CutContour Dieline)', () => {
  beforeEach(() => {
    const mockCtx = {
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      createImageData: vi.fn((w, h) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      }))
    };

    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: vi.fn(() => mockCtx)
    };

    // @ts-ignore
    global.document = {
      createElement: vi.fn((tagName: string) => {
        if (tagName === 'canvas') return mockCanvas;
        return {};
      }) as any
    };
  });

  it('should process transparent sticker image and generate 3 layers', () => {
    const w = 50;
    const h = 50;
    const data = new Uint8ClampedArray(w * h * 4);

    // Fill center 20x20 with solid color (alpha=255), leave outer area transparent (alpha=0)
    for (let y = 15; y < 35; y++) {
      for (let x = 15; x < 35; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 100;
        data[idx + 2] = 50;
        data[idx + 3] = 255;
      }
    }

    const imgData = { width: w, height: h, data } as ImageData;
    const output = DielineEngine.generateLayers(imgData, 2, 6);

    expect(output.hasTransparency).toBe(true);
    expect(output.totalSolidPixels).toBe(400);
    expect(output.cmykCanvas).toBeDefined();
    expect(output.whiteInkCanvas).toBeDefined();
    expect(output.cutContourCanvas).toBeDefined();
    expect(output.compositeCanvas).toBeDefined();
  });
});

// 2026-08-28: erode()/dilate() were rewritten from an O(w·h·radius²) brute-force circular window
// scan to an O(w·h) separable (horizontal-then-vertical) box filter — a real perf fix (the old
// version could take billions of operations on a large image at typical radii), but also a real
// algorithm rewrite that needs its own direct correctness check, not just "the pipeline didn't
// crash." These reach the private static methods directly (TypeScript's `private` is compile-time
// only) since they're not exposed on the public API and testing indirectly through the mocked
// canvas pipeline above can't verify exact pixel output.
describe('DielineEngine morphology (erode/dilate) — separable box filter correctness', () => {
  function solidMask(w: number, h: number): Uint8Array {
    return new Uint8Array(w * h).fill(1);
  }

  it('erode should shrink a fully-solid mask by exactly `radius` on every side (square structuring element)', () => {
    const w = 20, h = 20, radius = 3;
    const mask = solidMask(w, h);
    const eroded: Uint8Array = (DielineEngine as any).erode(mask, w, h, radius);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const withinBorder = x < radius || x >= w - radius || y < radius || y >= h - radius;
        const expected = withinBorder ? 0 : 1;
        expect(eroded[y * w + x]).toBe(expected);
      }
    }
  });

  it('dilate should grow a single point into an exact (2r+1)x(2r+1) square', () => {
    const w = 21, h = 21, radius = 2;
    const mask = new Uint8Array(w * h); // all zero
    const cx = 10, cy = 10;
    mask[cy * w + cx] = 1;

    const dilated: Uint8Array = (DielineEngine as any).dilate(mask, w, h, radius);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inSquare = Math.abs(x - cx) <= radius && Math.abs(y - cy) <= radius;
        expect(dilated[y * w + x]).toBe(inSquare ? 1 : 0);
      }
    }
  });

  it('erode should return an all-zero mask when radius exceeds half the solid region (no false survivors)', () => {
    const w = 10, h = 10, radius = 5; // window covers the whole 10-wide image at any position
    const mask = solidMask(w, h);
    const eroded: Uint8Array = (DielineEngine as any).erode(mask, w, h, radius);
    expect(eroded.every((v) => v === 0)).toBe(true);
  });

  it('dilate should leave a fully-solid mask fully solid (no shrinkage, no out-of-bounds crash)', () => {
    const w = 12, h = 12, radius = 4;
    const mask = solidMask(w, h);
    const dilated: Uint8Array = (DielineEngine as any).dilate(mask, w, h, radius);
    expect(dilated.every((v) => v === 1)).toBe(true);
  });

  it('radius=0 should be a no-op copy for both operations', () => {
    const w = 8, h = 8;
    const mask = new Uint8Array(w * h);
    mask[10] = 1;
    mask[20] = 1;
    const eroded: Uint8Array = (DielineEngine as any).erode(mask, w, h, 0);
    const dilated: Uint8Array = (DielineEngine as any).dilate(mask, w, h, 0);
    expect(Array.from(eroded)).toEqual(Array.from(mask));
    expect(Array.from(dilated)).toEqual(Array.from(mask));
  });
});
