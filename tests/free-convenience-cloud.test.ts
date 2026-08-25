import { describe, it, expect } from 'vitest';
import { ConvenienceStoreEngine, CONVENIENCE_STORE_SPECS } from '../src/core/convenience-store';

describe('ConvenienceStoreEngine (real print-ready file generator, no fake orders/QR)', () => {
  it('should generate a correctly-sized 300 DPI print-ready canvas for a given spec', async () => {
    const spec = CONVENIENCE_STORE_SPECS[0]; // 7-11 Photo 4x6
    const srcImageData = { width: 40, height: 40, data: new Uint8ClampedArray(40 * 40 * 4).fill(200) } as ImageData;

    // @ts-ignore minimal canvas mock for node test environment
    global.document = {
      createElement: (tag: string) => {
        if (tag !== 'canvas') return {};
        const canvas: any = {
          width: 0,
          height: 0,
          getContext: () => ({
            fillStyle: '',
            fillRect: () => {},
            putImageData: () => {},
            drawImage: () => {},
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
          })
        };
        return canvas;
      }
    } as any;

    const canvas = await ConvenienceStoreEngine.generatePrintReadyCanvas(srcImageData, spec);
    expect(canvas.width).toBe(spec.widthPx300Dpi);
    expect(canvas.height).toBe(spec.heightPx300Dpi);
  });

  it('should list real official upload URLs for every spec, no fabricated order/QR API', () => {
    for (const spec of CONVENIENCE_STORE_SPECS) {
      expect(spec.uploadUrl).toMatch(/^https:\/\//);
    }
    // The fake pickup-PIN/QR order generator was removed — confirm it's actually gone.
    expect((ConvenienceStoreEngine as any).generateCloudOrder).toBeUndefined();
  });
});
