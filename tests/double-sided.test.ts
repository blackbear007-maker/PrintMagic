import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DoubleSidedManager } from '../src/core/double-sided';
import { getPresetById } from '../src/core/presets';

describe('DoubleSidedManager (Front & Back Double-Sided Linking)', () => {
  beforeEach(() => {
    // Setup Mock HTMLCanvasElement & 2D Context for node test environment
    const mockCtx = {
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
      getImageData: vi.fn(() => ({ width: 1480, height: 1000, data: new Uint8ClampedArray(1480 * 1000 * 4) }))
    };

    const mockCanvas = {
      width: 1480,
      height: 1000,
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => 'data:image/png;base64,mockback')
    };

    // @ts-ignore
    global.document = {
      createElement: vi.fn((tagName: string) => {
        if (tagName === 'canvas') return mockCanvas;
        return {};
      }) as any
    };
  });

  it('should initialize with activeSide=front and hasBack=false', () => {
    const mgr = new DoubleSidedManager();
    const state = mgr.getState();
    expect(state.activeSide).toBe('front');
    expect(state.hasBack).toBe(false);
  });

  it('should procedurally generate postcard standard back template', () => {
    const postcardPreset = getPresetById('postcard');
    const result = DoubleSidedManager.generateBackTemplate('postcard_standard', postcardPreset);
    expect(result.dataUrl).toBeDefined();
    expect(result.imageData).toBeDefined();
  });

  it('should switch activeSide and retain front & back images', () => {
    const mgr = new DoubleSidedManager();
    const dummyFrontImg = { width: 100, height: 100, data: new Uint8ClampedArray(40000) } as ImageData;
    const dummyBackImg = { width: 100, height: 100, data: new Uint8ClampedArray(40000) } as ImageData;

    mgr.setFrontImage('data:front', dummyFrontImg);
    mgr.setBackImage('data:back', dummyBackImg);

    expect(mgr.getState().hasBack).toBe(true);
    expect(mgr.getState().frontDataUrl).toBe('data:front');
    expect(mgr.getState().backDataUrl).toBe('data:back');

    mgr.setActiveSide('back');
    expect(mgr.getState().activeSide).toBe('back');
  });
});
