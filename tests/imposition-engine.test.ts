import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImpositionEngine } from '../src/core/imposition-engine';

describe('ImpositionEngine (Gang-Run Imposition for A4/A3)', () => {
  it('should calculate optimal layout for 90x54mm business cards on A4', () => {
    const layout = ImpositionEngine.calculateLayout(90, 54, 'A4');
    expect(layout.sheetPreset).toBe('A4');
    expect(layout.sheetWidthMm).toBe(210);
    expect(layout.sheetHeightMm).toBe(297);
    expect(layout.totalCells).toBeGreaterThanOrEqual(8);
    expect(layout.costSavingsPercent).toBeGreaterThanOrEqual(70);
  });

  it('should calculate optimal layout for 50x50mm stickers on A4', () => {
    const layout = ImpositionEngine.calculateLayout(50, 50, 'A4');
    expect(layout.totalCells).toBeGreaterThanOrEqual(15);
    expect(layout.costSavingsPercent).toBeGreaterThan(80);
  });

  it('should calculate optimal layout for 148x100mm postcards on A3', () => {
    const layout = ImpositionEngine.calculateLayout(148, 100, 'A3');
    expect(layout.sheetPreset).toBe('A3');
    expect(layout.totalCells).toBe(4);
    expect(layout.costSavingsPercent).toBe(75);
  });

  // 2026-08-27: confirms the existing gang-run engine (built for business cards/stickers) also
  // works correctly for the 35x45mm ID photo preset — this is what backs the "batch ID photo
  // sheet" use case, no new engine code needed, just wiring a discoverable entry point to it
  // (see main.ts's applyIdPhotoCrop()).
  it('should calculate a sane, non-degenerate layout for 35x45mm ID photos on A4', () => {
    const layout = ImpositionEngine.calculateLayout(35, 45, 'A4');
    expect(layout.cols).toBeGreaterThan(0);
    expect(layout.rows).toBeGreaterThan(0);
    expect(layout.totalCells).toBe(28);
    expect(layout.costSavingsPercent).toBeGreaterThan(80);
    // 28 cells only beats the 25-cell non-rotated layout via the rotated packing path — this is
    // exactly the real-world case that exposed the "swapped dimensions but never actually rotates
    // the drawn image" bug (2026-08-29), since it's the default ID-photo/A4 combination.
    expect(layout.isRotated).toBe(true);
    expect(layout.cellWidthMm).toBe(45); // swapped: cell width = item HEIGHT
    expect(layout.cellHeightMm).toBe(35); // swapped: cell height = item WIDTH
  });

  it('should calculate a sane, non-degenerate layout for 35x45mm ID photos on A3', () => {
    const layout = ImpositionEngine.calculateLayout(35, 45, 'A3');
    expect(layout.totalCells).toBe(56);
  });

  it('should NOT report isRotated when the normal orientation already packs at least as many items', () => {
    // Square items: rotation can never do better than normal orientation, so isRotated must be false.
    const layout = ImpositionEngine.calculateLayout(50, 50, 'A4');
    expect(layout.isRotated).toBe(false);
    expect(layout.cellWidthMm).toBe(50);
    expect(layout.cellHeightMm).toBe(50);
  });

  describe('generateImpositionCanvas — actually rotates the image instead of stretching it (2026-08-29 fix)', () => {
    const makeMockCtx = () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn()
    });

    beforeEach(() => {
      const mockCtx = makeMockCtx();
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx)
      };
      // @ts-ignore
      global.document = {
        createElement: vi.fn(() => mockCanvas)
      } as any;
    });

    const makeItem = (w: number, h: number): ImageData =>
      ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' } as ImageData);

    it('calls ctx.rotate() when the layout is rotated', async () => {
      const layout = ImpositionEngine.calculateLayout(35, 45, 'A4'); // isRotated: true (verified above)
      expect(layout.isRotated).toBe(true);

      const canvas = await ImpositionEngine.generateImpositionCanvas([makeItem(35, 45)], layout, true);
      const ctx = canvas.getContext('2d') as any;
      expect(ctx.rotate).toHaveBeenCalled();
      expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
      // save/restore must bracket every rotated draw so the rotation doesn't leak into crop marks
      expect(ctx.save.mock.calls.length).toBe(ctx.restore.mock.calls.length);
      expect(ctx.save.mock.calls.length).toBe(layout.totalCells);
    });

    it('does NOT call ctx.rotate() when the layout is not rotated', async () => {
      const layout = ImpositionEngine.calculateLayout(50, 50, 'A4'); // isRotated: false (verified above)
      expect(layout.isRotated).toBe(false);

      const canvas = await ImpositionEngine.generateImpositionCanvas([makeItem(50, 50)], layout, true);
      const ctx = canvas.getContext('2d') as any;
      expect(ctx.rotate).not.toHaveBeenCalled();
    });
  });
});
