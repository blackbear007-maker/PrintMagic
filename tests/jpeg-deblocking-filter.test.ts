import { describe, it, expect, beforeAll } from 'vitest';
import { JpegDeblockingFilter } from '../src/core/jpeg-deblocking-filter';

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

// Classic JPEG blocking signature: flat 8x8 blocks, each block a slightly different constant
// value, producing a sharp step exactly at every x,y ≡ 0 (mod 8) grid line and nothing else.
function blockedArtifactImage(size: number): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const blockX = Math.floor(x / 8);
      const blockY = Math.floor(y / 8);
      const val = 100 + ((blockX + blockY) % 2) * 40; // alternating flat blocks: 100 / 140
      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  // @ts-ignore
  return { data, width: size, height: size } as ImageData;
}

// A perfectly smooth continuous ramp — the same per-pixel slope everywhere, including at every
// 8px grid line, so there is no isolated jump signature to detect.
function smoothGradientImage(size: number): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const val = Math.round((x / size) * 255);
      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  // @ts-ignore
  return { data, width: size, height: size } as ImageData;
}

function maxVerticalBoundaryJump(imgData: ImageData, gridPos: number): number {
  const { data, width, height } = imgData;
  let maxJump = 0;
  for (let y = 0; y < height; y++) {
    const left = data[(y * width + (gridPos - 1)) * 4];
    const right = data[(y * width + gridPos) * 4];
    maxJump = Math.max(maxJump, Math.abs(right - left));
  }
  return maxJump;
}

describe('JpegDeblockingFilter', () => {
  it('should preserve dimensions and alpha', () => {
    const img = blockedArtifactImage(16);
    const out = JpegDeblockingFilter.deblock(img);
    expect(out.width).toBe(16);
    expect(out.height).toBe(16);
    expect(out.data[3]).toBe(255);
  });

  it('should substantially reduce the discontinuity at real 8x8 block boundaries', () => {
    const img = blockedArtifactImage(32);
    const beforeJump = maxVerticalBoundaryJump(img, 8);
    expect(beforeJump).toBe(40); // sanity: the synthetic artifact is exactly a 40-unit step

    const out = JpegDeblockingFilter.deblock(img, 0.8, 6);
    const afterJump = maxVerticalBoundaryJump(out, 8);

    expect(afterJump).toBeLessThanOrEqual(beforeJump * 0.6);
  });

  it('should leave block interiors (away from grid lines) untouched', () => {
    const img = blockedArtifactImage(32);
    const out = JpegDeblockingFilter.deblock(img, 0.8, 6);
    // Pixel at x=4 (middle of the first 8-wide block) should be exactly unchanged.
    const idx = (4 * 32 + 4) * 4;
    expect(out.data[idx]).toBe(img.data[idx]);
  });

  it('should NOT touch a smooth continuous gradient (no isolated artifact signature to find)', () => {
    const img = smoothGradientImage(32);
    const out = JpegDeblockingFilter.deblock(img, 0.8, 2);
    for (let i = 0; i < img.data.length; i += 4) {
      expect(out.data[i]).toBe(img.data[i]);
    }
  });
});
