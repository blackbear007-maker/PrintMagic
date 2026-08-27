import { describe, it, expect } from 'vitest';
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
  });

  it('should calculate a sane, non-degenerate layout for 35x45mm ID photos on A3', () => {
    const layout = ImpositionEngine.calculateLayout(35, 45, 'A3');
    expect(layout.totalCells).toBe(56);
  });
});
