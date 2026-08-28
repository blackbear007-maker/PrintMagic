import { describe, it, expect } from 'vitest';
import { AiVectorizer, Point } from '../src/core/ai-vectorizer';

// Reference O(n^2) implementation of the pre-optimization buildContourChains, used to prove the
// spatial-grid rewrite is an exact equivalence (including tie-breaking) rather than an approximation.
function bruteForceContourChains(points: Point[], maxDist: number): Point[][] {
  const chains: Point[][] = [];
  const visited = new Uint8Array(points.length);
  const maxDistSq = maxDist * maxDist;

  for (let i = 0; i < points.length; i++) {
    if (visited[i]) continue;
    const chain: Point[] = [points[i]];
    visited[i] = 1;
    let current = points[i];
    let foundNext = true;
    while (foundNext) {
      foundNext = false;
      let nearestIdx = -1;
      let nearestDistSq = maxDistSq;
      for (let j = 0; j < points.length; j++) {
        if (visited[j]) continue;
        const dx = points[j].x - current.x;
        const dy = points[j].y - current.y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= nearestDistSq) {
          nearestDistSq = dSq;
          nearestIdx = j;
        }
      }
      if (nearestIdx !== -1) {
        visited[nearestIdx] = 1;
        current = points[nearestIdx];
        chain.push(current);
        foundNext = true;
        if (chain.length > 250) break;
      }
    }
    if (chain.length >= 2) chains.push(chain);
  }
  return chains;
}

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

  describe('buildContourChains — spatial grid gives identical output to brute-force scan', () => {
    const runComparison = (points: Point[], maxDist: number) => {
      const gridResult = (AiVectorizer as any).buildContourChains(points, maxDist);
      const bruteResult = bruteForceContourChains(points, maxDist);
      expect(gridResult).toEqual(bruteResult);
    };

    it('matches on a regular grid of points (heavy exact-distance ties)', () => {
      const points: Point[] = [];
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          points.push({ x: x * 3, y: y * 3 });
        }
      }
      runComparison(points, 3 * 2.2);
    });

    it('matches on scattered irregular points', () => {
      let seed = 42;
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      const points: Point[] = Array.from({ length: 300 }, () => ({
        x: Math.floor(rand() * 200),
        y: Math.floor(rand() * 200),
      }));
      runComparison(points, 8);
    });

    it('matches with multiple disjoint clusters', () => {
      const points: Point[] = [];
      for (let cx = 0; cx < 3; cx++) {
        for (let cy = 0; cy < 3; cy++) {
          for (let i = 0; i < 15; i++) {
            points.push({ x: cx * 100 + (i % 5) * 2, y: cy * 100 + Math.floor(i / 5) * 2 });
          }
        }
      }
      runComparison(points, 4.4);
    });

    it('matches on a single point and empty input', () => {
      runComparison([{ x: 5, y: 5 }], 10);
      runComparison([], 10);
    });
  });
});
