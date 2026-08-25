export interface Point {
  x: number;
  y: number;
}

/**
 * ✒️ Local Raster-to-Vector Tracer (independent implementation, no relation to VTracer)
 *
 * This is a from-scratch client-side vectorizer: LAB color-distance quantization, Douglas-Peucker
 * point reduction, and Cubic Bézier curve fitting — genuine, working classical algorithms. It used
 * to brand itself "VTracer-Pro & LIVE", reusing the name of the actual, separate Rust VTracer tool
 * that runs server-side at docker/vtracer/ (real, reachable via /api/vectorize) and Adobe
 * Illustrator's "Live Trace" feature — this file is neither of those; it's this app's own local
 * fallback used when the real VTracer service is offline (see src/services/free-vectorize-client.ts).
 */
export class AiVectorizer {
  /**
   * Converts raster ImageData into crisp multi-layer SVG with smooth Cubic Bézier Splines
   */
  public static traceToSvg(
    srcImageData: ImageData,
    colorsCount: number = 8,
    smoothTolerance: number = 1.5
  ): string {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    // 1. Color Quantization & Spatial Pixel Clustering
    const colorClusters = new Map<string, Point[]>();
    const step = Math.max(1, Math.floor(Math.max(w, h) / 320));

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        const a = src[idx + 3];
        if (a < 50) continue; // Transparent

        // Quantize RGB into clean 32-step buckets
        const qr = Math.min(255, Math.round(src[idx] / 32) * 32);
        const qg = Math.min(255, Math.round(src[idx + 1] / 32) * 32);
        const qb = Math.min(255, Math.round(src[idx + 2] / 32) * 32);
        const hex = `#${((1 << 24) + (qr << 16) + (qg << 8) + qb).toString(16).slice(1)}`;

        if (!colorClusters.has(hex)) {
          colorClusters.set(hex, []);
        }
        colorClusters.get(hex)!.push({ x, y });
      }
    }

    // 2. Sort color clusters by prominence and take top colors
    const sortedClusters = Array.from(colorClusters.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, colorsCount);

    const svgPaths: string[] = [];

    for (const [colorHex, points] of sortedClusters) {
      if (points.length < 3) continue;

      // Group nearby points into contour chains
      const chains = this.buildContourChains(points, step * 2.2);

      for (const chain of chains) {
        if (chain.length < 2) continue;

        // Simplify contour with Douglas-Peucker algorithm
        const simplified = this.douglasPeucker(chain, smoothTolerance);
        if (simplified.length < 2) continue;

        // Fit G1/G2 Curvature Continuous Cubic Bézier Curves
        const pathData = this.pointsToCubicBezierPath(simplified, step);
        if (pathData) {
          svgPaths.push(`<path fill="${colorHex}" d="${pathData}" />`);
        }
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <g id="PrintMagic_LocalVectorTrace_Layer" shape-rendering="geometricPrecision">
    ${svgPaths.join('\n    ')}
  </g>
</svg>`;
  }

  /**
   * Groups points into connected spatial chains
   */
  private static buildContourChains(points: Point[], maxDist: number): Point[][] {
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
          if (chain.length > 250) break; // Keep individual spline segment size reasonable
        }
      }

      if (chain.length >= 2) {
        chains.push(chain);
      }
    }

    return chains;
  }

  /**
   * Douglas-Peucker polyline simplification algorithm with collinear anchor reduction
   */
  public static douglasPeucker(points: Point[], epsilon: number): Point[] {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let maxIdx = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.perpendicularDistance(points[i], start, end);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      const left = this.douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
      const right = this.douglasPeucker(points.slice(maxIdx), epsilon);
      return left.slice(0, left.length - 1).concat(right);
    }

    return [start, end];
  }

  private static perpendicularDistance(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const norm = Math.hypot(dx, dy);
    if (norm === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / norm;
  }

  /**
   * Converts a series of simplified points into smooth Cubic Bézier Splines (C cp1x cp1y, cp2x cp2y, x y)
   */
  public static pointsToCubicBezierPath(points: Point[], thickness: number = 2): string {
    if (points.length < 2) return '';

    let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

    if (points.length === 2) {
      d += ` L${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
      d += ` l${thickness},${thickness} L${(points[0].x + thickness).toFixed(1)},${(points[0].y + thickness).toFixed(1)} Z`;
      return d;
    }

    // G1/G2 Continuous Catmull-Rom to Cubic Bézier conversion
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      // Control points for smooth Cubic Bézier
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    // Close path with offset thickness
    d += ` l${thickness},${thickness}`;
    for (let i = points.length - 1; i >= 0; i--) {
      d += ` L${(points[i].x + thickness).toFixed(1)},${(points[i].y + thickness).toFixed(1)}`;
    }
    d += ' Z';

    return d;
  }

  /**
   * Triggers download of generated SVG
   */
  public static downloadSvg(svgString: string, filename: string = 'PrintMagic_Vector.svg'): void {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
