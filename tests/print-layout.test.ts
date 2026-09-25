import { describe, it, expect } from 'vitest';
import { coverFit, trimForImage } from '../src/core/print-layout';
import { PRINT_PRESETS } from '../src/core/presets';

// 2026-09-26: exporters used the preset's fixed orientation and stretched the image into it, so a
// landscape photo on the A4 preset (the fallback for any unmatched ratio) printed squeezed into a
// portrait page.
describe('trimForImage', () => {
  const a4 = PRINT_PRESETS['poster-a4']; // 210 × 297, 3mm bleed

  it('keeps the preset orientation when the image matches it', () => {
    expect(trimForImage(a4, 2480, 3508)).toEqual({ widthMm: 210, heightMm: 297, bleedMm: 3 });
  });

  it('turns the trim to landscape for a landscape image', () => {
    expect(trimForImage(a4, 4000, 3000)).toEqual({ widthMm: 297, heightMm: 210, bleedMm: 3 });
  });

  it('leaves square presets and square images alone', () => {
    const sticker = PRINT_PRESETS['sticker'];
    expect(trimForImage(sticker, 1200, 800)).toMatchObject({ widthMm: sticker.widthMm, heightMm: sticker.heightMm });
    expect(trimForImage(a4, 2000, 2000)).toMatchObject({ widthMm: 210, heightMm: 297 });
  });

  it('uses the image itself at the target DPI for a preset without a physical size', () => {
    const social = PRINT_PRESETS['social'];
    const t = trimForImage(social, 2048, 2048);
    const dpi = social.targetDpi > 0 ? social.targetDpi : 300;
    expect(t.widthMm).toBeCloseTo((2048 / dpi) * 25.4, 6);
    expect(t.heightMm).toBeCloseTo(t.widthMm, 6);
    expect(t.bleedMm).toBe(0);
  });
});

describe('coverFit', () => {
  it('scales uniformly to cover the box and crops the longer axis', () => {
    const r = coverFit(100, 100, 400, 200); // 2:1 image into a square
    expect(r.height).toBe(100);
    expect(r.width).toBe(200); // same scale on both axes: no distortion
    expect(r.x).toBe(-50); // centred
    expect(r.y).toBe(0);
  });

  it('keeps the anchored side', () => {
    expect(coverFit(100, 100, 400, 200, 'left').x).toBe(0);
    expect(coverFit(100, 100, 400, 200, 'right').x).toBe(-100);
    expect(coverFit(100, 100, 200, 400, 'top').y).toBe(0);
    expect(coverFit(100, 100, 200, 400, 'bottom').y).toBe(-100);
  });

  it('is an exact fit when the ratios already match', () => {
    expect(coverFit(216, 303, 2551, 3579)).toMatchObject({ x: expect.closeTo(0, 1), y: expect.closeTo(0, 1) });
  });
});
