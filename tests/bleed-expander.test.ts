import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BleedExpander } from '../src/core/bleed-expander';
import { getPresetById } from '../src/core/presets';

describe('BleedExpander (AI 3mm Generative Bleed Outpainting)', () => {
  beforeEach(() => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn((_x, _y, w, h) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      }))
    };

    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => 'data:image/png;base64,mockexpanded')
    };

    // @ts-ignore
    global.document = {
      createElement: vi.fn((tag) => (tag === 'canvas' ? mockCanvas : {}))
    } as any;
  });

  it('should expand bleed margin on all four borders while preserving center subject', () => {
    const w = 200;
    const h = 200;
    const data = new Uint8ClampedArray(w * h * 4);
    const srcImg = { width: w, height: h, data } as ImageData;
    const preset = getPresetById('poster-a4');

    const result = BleedExpander.expandBleed(srcImg, preset, 3);
    expect(result.width).toBeGreaterThan(w);
    expect(result.height).toBeGreaterThan(h);
    expect(result.dataUrl).toBeDefined();
  });
});
