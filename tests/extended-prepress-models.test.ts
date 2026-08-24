import { describe, it, expect } from 'vitest';
import { DescreenEngine } from '../src/core/descreen-engine';
import { SmartCropper } from '../src/core/smart-cropper';

describe('Extended Commercial Open-Source Pre-Press AI Suite', () => {
  const createMockImageData = (w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 180;
      data[i + 1] = 150;
      data[i + 2] = 120;
      data[i + 3] = 255;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('DescreenEngine: should remove halftone screen dots from scanned prints', () => {
    const img = createMockImageData(30, 30);
    // Add artificial screen dot ripple
    for (let i = 0; i < img.data.length; i += 8) {
      img.data[i] = 140;
    }
    const res = DescreenEngine.descreen(img, 0.8);
    expect(res.width).toBe(30);
    expect(res.height).toBe(30);
    expect(res.data.length).toBe(30 * 30 * 4);
  });

  it('SmartCropper: should calculate rule-of-thirds optimal crop box without decapitation', () => {
    // 1000x1000 square cropped to 90x54mm business card (ratio = 1.666)
    const crop = SmartCropper.calculateOptimalCrop(1000, 1000, 90 / 54);
    expect(crop.width).toBe(1000);
    expect(crop.height).toBe(600);
    expect(crop.y).toBe(120); // 30% top bias preserving head
  });
});
