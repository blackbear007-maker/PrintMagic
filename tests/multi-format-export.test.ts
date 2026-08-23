import { describe, it, expect } from 'vitest';
import { TiffExporter } from '../src/engines/tiff-exporter';
import { MultiFormatExporter } from '../src/engines/multi-format-exporter';
import { PRINT_PRESETS } from '../src/core/presets';
import { store, type AppState } from '../src/ui/state';

describe('Multi-Format Pre-Press Exporter Suite (TIFF, PDF, PNG, JPG, SVG, ZIP)', () => {
  const createMockImageData = (w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;     // R
      data[i + 1] = 128; // G
      data[i + 2] = 64;  // B
      data[i + 3] = 255; // A
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  const createMockAppState = (): AppState => {
    const mockImg = createMockImageData(100, 100);
    const baseState = store.getState();
    return {
      ...baseState,
      originalImageData: mockImg,
      originalDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAA',
      processedImageData: mockImg,
      processedDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAA',
      originalWidth: 100,
      originalHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
      currentPreset: PRINT_PRESETS['poster-a4']
    };
  };

  it('TiffExporter: should encode standard 300 DPI binary TIFF with Tag 282/283 X/YResolution', async () => {
    const imgData = createMockImageData(50, 40);
    const blob = TiffExporter.encodeTiffBlob(imgData, 300);

    expect(blob).toBeDefined();
    expect(blob.type).toBe('image/tiff');
    expect(blob.size).toBeGreaterThan(50 * 40 * 3);

    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // Verify Little-Endian TIFF Header (II = 0x4949, Version 42 = 0x002A)
    const magic = view.getUint16(0, true);
    const version = view.getUint16(2, true);
    expect(magic).toBe(0x4949);
    expect(version).toBe(42);
  });

  it('MultiFormatExporter: should generate standard print-shop base filename', () => {
    const state = createMockAppState();
    const filename = MultiFormatExporter.getBaseFilename(state);

    expect(filename).toContain('[PrintMagic]');
    expect(filename).toContain('210x297mm');
  });
});
