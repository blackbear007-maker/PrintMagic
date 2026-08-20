import { describe, it, expect } from 'vitest';
import { ObjectEraser } from '../src/core/object-eraser';

describe('ObjectEraser (AI Inpainting & Object Removal Engine)', () => {
  // Helper to create synthetic ImageData in Node test environment
  const createMockImageData = (width: number, height: number, fillColor: [number, number, number, number] = [255, 0, 0, 255]) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const p = i * 4;
      data[p] = fillColor[0];
      data[p + 1] = fillColor[1];
      data[p + 2] = fillColor[2];
      data[p + 3] = fillColor[3];
    }
    // @ts-ignore
    return { data, width, height } as ImageData;
  };

  it('should return untouched image if mask has no marked removal pixels', () => {
    const src = createMockImageData(60, 60, [100, 150, 200, 255]);
    const emptyMask = createMockImageData(60, 60, [0, 0, 0, 0]);

    const result = ObjectEraser.inpaint(src, emptyMask);
    expect(result.width).toBe(60);
    expect(result.height).toBe(60);

    // Verify all pixels remain identical
    for (let i = 0; i < src.data.length; i++) {
      expect(result.data[i]).toBe(src.data[i]);
    }
  });

  it('should seamlessly remove a black box in a solid green background', () => {
    const width = 50;
    const height = 50;
    // Green background: RGB(30, 200, 50, 255)
    const src = createMockImageData(width, height, [30, 200, 50, 255]);
    const mask = createMockImageData(width, height, [0, 0, 0, 0]);

    // Add a black artifact in the center (from x:20..30, y:20..30)
    for (let y = 20; y <= 30; y++) {
      for (let x = 20; x <= 30; x++) {
        const p = (y * width + x) * 4;
        src.data[p] = 0;     // R
        src.data[p + 1] = 0; // G
        src.data[p + 2] = 0; // B
        src.data[p + 3] = 255;

        // Mark in mask
        mask.data[p] = 255;
        mask.data[p + 1] = 0;
        mask.data[p + 2] = 0;
        mask.data[p + 3] = 255;
      }
    }

    const inpainted = ObjectEraser.inpaint(src, mask, { radius: 5, dilation: 2, smoothPasses: 2 });

    // Verify the center pixel (25, 25) was restored from 0 back to close to surrounding green
    const centerIdx = (25 * width + 25) * 4;
    expect(inpainted.data[centerIdx]).toBeGreaterThanOrEqual(25);      // Red ~ 30
    expect(inpainted.data[centerIdx]).toBeLessThanOrEqual(35);
    expect(inpainted.data[centerIdx + 1]).toBeGreaterThanOrEqual(190); // Green ~ 200
    expect(inpainted.data[centerIdx + 1]).toBeLessThanOrEqual(210);
    expect(inpainted.data[centerIdx + 2]).toBeGreaterThanOrEqual(45);  // Blue ~ 50
    expect(inpainted.data[centerIdx + 2]).toBeLessThanOrEqual(55);
    expect(inpainted.data[centerIdx + 3]).toBe(255);                   // Alpha intact
  });

  it('should interpolate smooth gradient across erased region', () => {
    const width = 80;
    const height = 40;
    const src = createMockImageData(width, height);
    const mask = createMockImageData(width, height, [0, 0, 0, 0]);

    // Create horizontal gradient from Black (0) on left to White (255) on right
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4;
        const val = Math.round((x / width) * 255);
        src.data[p] = val;
        src.data[p + 1] = val;
        src.data[p + 2] = val;
        src.data[p + 3] = 255;
      }
    }

    // Mask out a central column (x: 35..45, y: 10..30)
    for (let y = 10; y <= 30; y++) {
      for (let x = 35; x <= 45; x++) {
        const p = (y * width + x) * 4;
        // Corrupt with neon red noise
        src.data[p] = 255;
        src.data[p + 1] = 0;
        src.data[p + 2] = 0;

        mask.data[p + 3] = 255;
      }
    }

    const inpainted = ObjectEraser.inpaint(src, mask, { radius: 6, dilation: 2, smoothPasses: 2 });

    // Midpoint x=40 should have value close to 40/80 * 255 ≈ 128 (grayscale)
    const midP = (20 * width + 40) * 4;
    expect(inpainted.data[midP]).toBeGreaterThan(90);
    expect(inpainted.data[midP]).toBeLessThan(160);
    // R, G, B should be close to each other (grayscale gradient maintained)
    expect(Math.abs(inpainted.data[midP] - inpainted.data[midP + 1])).toBeLessThanOrEqual(15);
    expect(Math.abs(inpainted.data[midP + 1] - inpainted.data[midP + 2])).toBeLessThanOrEqual(15);
  });
});
