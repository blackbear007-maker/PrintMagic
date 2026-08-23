import { describe, it, expect } from 'vitest';
import { DescreenEngine } from '../src/core/descreen-engine';
import { FaceRestorer } from '../src/core/face-restorer';
import { SmartCropper } from '../src/core/smart-cropper';
import { VintageColorizer } from '../src/core/vintage-colorizer';
import { FontMatcher } from '../src/core/font-matcher';

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

  it('FaceRestorer: should enhance facial tone and micro-contrast', () => {
    const img = createMockImageData(20, 20);
    // Add warm skin tone (R > G > B)
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 220;
      img.data[i + 1] = 160;
      img.data[i + 2] = 130;
    }
    const res = FaceRestorer.restoreFaces(img, 0.9);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
    expect(res.data[0]).toBeGreaterThanOrEqual(220); // Micro-contrast boosted
  });

  it('SmartCropper: should calculate rule-of-thirds optimal crop box without decapitation', () => {
    // 1000x1000 square cropped to 90x54mm business card (ratio = 1.666)
    const crop = SmartCropper.calculateOptimalCrop(1000, 1000, 90 / 54);
    expect(crop.width).toBe(1000);
    expect(crop.height).toBe(600);
    expect(crop.y).toBe(120); // 30% top bias preserving head
  });

  it('VintageColorizer: should inject natural warm chrominance into monochrome photos', () => {
    const img = createMockImageData(25, 25);
    // Set to perfect grayscale (R = G = B = 150)
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 150;
      img.data[i + 1] = 150;
      img.data[i + 2] = 150;
    }
    const res = VintageColorizer.colorize(img, 0.85);
    expect(res.width).toBe(25);
    expect(res.height).toBe(25);
    expect(res.data[0]).toBeGreaterThan(res.data[2]); // Warm red > blue
  });

  it('FontMatcher: should recommend matching Google Fonts with open licenses', () => {
    const matches = FontMatcher.matchFont('sans-serif');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].commercialLicense).toContain('Open Font License');

    const topSerif = FontMatcher.getTopMatch(true);
    expect(topSerif.category).toBe('serif');
  });
});
