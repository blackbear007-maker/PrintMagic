import { describe, it, expect } from 'vitest';
import { detectBestPreset } from '../src/core/presets';

describe('Intelligent Preset Auto-Detection', () => {
  it('should auto-detect 1:1 small square as Die-cut Sticker', () => {
    const preset = detectBestPreset(800, 800);
    expect(preset.id).toBe('sticker');
  });

  it('should auto-detect 1:1 high-res square as Social HD', () => {
    const preset = detectBestPreset(2048, 2048);
    expect(preset.id).toBe('social');
  });

  it('should auto-detect ~1.66 aspect ratio as Business Card', () => {
    const preset = detectBestPreset(1060, 636); // 1.667
    expect(preset.id).toBe('business-card');
  });

  it('should auto-detect ~1.48 aspect ratio as Postcard', () => {
    const preset = detectBestPreset(1480, 1000); // 1.48
    expect(preset.id).toBe('postcard');
  });

  it('should auto-detect ~1.414 aspect ratio as A4 Poster', () => {
    const preset = detectBestPreset(2480, 1754); // ISO A4 ratio
    expect(preset.id).toBe('poster-a4');
  });

  it('should auto-detect ultra high-res ~1.414 aspect ratio as A3 Poster', () => {
    const preset = detectBestPreset(4960, 3508); // High res
    expect(preset.id).toBe('poster-a3');
  });
});
