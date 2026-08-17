import { describe, it, expect } from 'vitest';
import { AiVectorizer } from '../src/core/ai-vectorizer';

describe('AiVectorizer (Raster to True SVG Vector Bezier Curve Converter)', () => {
  it('should convert raster image into valid SVG vector markup', () => {
    const w = 40;
    const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);

    // Draw some shapes
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }

    const srcImg = { width: w, height: h, data } as ImageData;
    const svg = AiVectorizer.traceToSvg(srcImg, 8, 2);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('<path');
    expect(svg).toContain('#ff0000');
  });
});
