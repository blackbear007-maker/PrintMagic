import { describe, it, expect } from 'vitest';
import { ShadowLift } from '../src/core/shadow-lift';

describe('ShadowLift (Auto Pre-press Shadow Tone Recovery)', () => {
  it('should preserve pure black (0) while lifting dark shadow tones', () => {
    // 2x2 test image with [0 (pure black), 25 (dark shadow), 128 (midtones), 240 (highlights)]
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,      // Pure black anchor
      25, 25, 25, 255,   // Deep shadow
      128, 128, 128, 255,// Midtone
      240, 240, 240, 255 // Highlight
    ]);
    const imgData: ImageData = {
      width: 2,
      height: 2,
      data,
      colorSpace: 'srgb'
    } as ImageData;

    const lifted = ShadowLift.apply(imgData, 0.10);

    // Pure black should remain 0 to preserve anchor point
    expect(lifted.data[0]).toBe(0);

    // Deep shadow (25) should be lifted to avoid CMYK ink blocking
    expect(lifted.data[4]).toBeGreaterThan(25);

    // Midtone (128) and highlight (240) should remain identical or very close
    expect(lifted.data[8]).toBe(128);
    expect(lifted.data[12]).toBe(240);
  });
});
