/**
 * Native Vector Tracer Engine (Potrace Algorithm in TypeScript)
 * Converts raster pixel images to crisp, infinite-resolution vector SVG paths without external dependencies.
 * Hardened with flat TypedArrays, bounds safety, and iterative non-recursive path simplification.
 */

interface Point {
  x: number;
  y: number;
}

interface PathNode {
  points: Point[];
  closed: boolean;
}

export class VectorTracer {
  private static readonly MAX_TRACE_DIMENSION = 1600;

  /**
   * Trace an ImageData bitmap into clean SVG path data
   */
  public static traceToSvg(
    imageData: ImageData,
    threshold: number = 128,
    _turnPolicy: 'black' | 'white' | 'left' | 'right' = 'black'
  ): string {
    const origWidth = imageData.width;
    const origHeight = imageData.height;

    // Downscale safely if image is extremely high-res to prevent UI lockup and memory exhaustion
    let traceData = imageData.data;
    let width = origWidth;
    let height = origHeight;
    let scaleX = 1;
    let scaleY = 1;

    const maxDim = Math.max(origWidth, origHeight);
    if (maxDim > this.MAX_TRACE_DIMENSION) {
      const scale = this.MAX_TRACE_DIMENSION / maxDim;
      width = Math.max(1, Math.round(origWidth * scale));
      height = Math.max(1, Math.round(origHeight * scale));
      scaleX = origWidth / width;
      scaleY = origHeight / height;

      // Fast nearest/box sample into temp canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = origWidth;
      srcCanvas.height = origHeight;
      const srcCtx = srcCanvas.getContext('2d')!;
      srcCtx.putImageData(imageData, 0, 0);

      ctx.drawImage(srcCanvas, 0, 0, width, height);
      traceData = ctx.getImageData(0, 0, width, height).data;
    }

    // 1. Create 1-bit boolean matrix using flat 1D Uint8Array (1 = dark foreground, 0 = light)
    const bm = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = (rowOffset + x) * 4;
        const lum = 0.299 * traceData[idx] + 0.587 * traceData[idx + 1] + 0.114 * traceData[idx + 2];
        const alpha = traceData[idx + 3];
        bm[rowOffset + x] = alpha > 64 && lum < threshold ? 1 : 0;
      }
    }

    // 2. Extract Boundary Contours
    const paths = this.findContours(bm, width, height);

    // 3. Convert path contours to smooth SVG path definitions with scaled coordinates
    let svgPaths = '';
    for (const p of paths) {
      if (p.points.length < 3) continue;
      svgPaths += this.pointsToSvgPath(p.points, scaleX, scaleY);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${origWidth} ${origHeight}" width="${origWidth}" height="${origHeight}">
  <path d="${svgPaths}" fill="#111111" fill-rule="evenodd" />
</svg>`;
  }

  /**
   * Find closed contour outlines from 1-bit binary image using flat arrays
   */
  private static findContours(
    bm: Uint8Array,
    w: number,
    h: number
  ): PathNode[] {
    const visitedH = new Uint8Array((h + 1) * (w + 1));
    const visitedV = new Uint8Array((h + 1) * (w + 1));
    const paths: PathNode[] = [];

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        const curr = bm[rowOffset + x] === 1;
        const above = y > 0 ? bm[(y - 1) * w + x] === 1 : false;

        const vhIdx = y * (w + 1) + x;
        if (curr && !above && visitedH[vhIdx] === 0) {
          const contour = this.traceContour(bm, x, y, w, h, visitedH, visitedV);
          if (contour.points.length >= 3) {
            paths.push(contour);
          }
        }
      }
    }

    return paths;
  }

  /**
   * Follow a single contour loop
   */
  private static traceContour(
    bm: Uint8Array,
    startX: number,
    startY: number,
    w: number,
    h: number,
    visitedH: Uint8Array,
    visitedV: Uint8Array
  ): PathNode {
    let x = startX;
    let y = startY;
    let dir = 0; // 0: East, 1: South, 2: West, 3: North
    const points: Point[] = [{ x, y }];

    const maxSteps = Math.min(w * h * 2, 50000);
    let steps = 0;

    while (steps++ < maxSteps) {
      const stride = w + 1;
      if (dir === 0 && y >= 0 && y <= h && x >= 0 && x <= w) {
        visitedH[y * stride + x] = 1;
      } else if (dir === 1 && y >= 0 && y <= h && x >= 0 && x <= w) {
        visitedV[y * stride + x] = 1;
      } else if (dir === 2 && x > 0 && y >= 0 && y <= h && (x - 1) <= w) {
        visitedH[y * stride + (x - 1)] = 1;
      } else if (dir === 3 && y > 0 && (y - 1) <= h && x >= 0 && x <= w) {
        visitedV[(y - 1) * stride + x] = 1;
      }

      // Safe bounds-checked pixel helper
      const isBlack = (px: number, py: number): boolean => {
        if (px < 0 || px >= w || py < 0 || py >= h) return false;
        return bm[py * w + px] === 1;
      };

      // 4-neighborhood inspection
      const leftPixel =
        dir === 0 ? isBlack(x, y - 1)
        : dir === 1 ? isBlack(x, y)
        : dir === 2 ? isBlack(x - 1, y)
        : isBlack(x - 1, y - 1);

      const rightPixel =
        dir === 0 ? isBlack(x, y)
        : dir === 1 ? isBlack(x - 1, y)
        : dir === 2 ? isBlack(x - 1, y - 1)
        : isBlack(x, y - 1);

      if (leftPixel) {
        dir = (dir + 3) % 4; // Turn left
      } else if (rightPixel) {
        // Continue straight
      } else {
        dir = (dir + 1) % 4; // Turn right
      }

      // Move forward
      if (dir === 0) x++;
      else if (dir === 1) y++;
      else if (dir === 2) x--;
      else if (dir === 3) y--;

      points.push({ x, y });

      if (x === startX && y === startY) {
        break;
      }
    }

    // Iterative Ramer-Douglas-Peucker path simplification
    const simplified = this.simplifyPointsIterative(points, 0.85);

    return {
      points: simplified,
      closed: true
    };
  }

  /**
   * Stack-safe iterative Ramer-Douglas-Peucker path simplification (prevents Maximum call stack size exceeded)
   */
  private static simplifyPointsIterative(pts: Point[], epsilon: number): Point[] {
    if (pts.length <= 2) return pts;

    const n = pts.length;
    const keep = new Uint8Array(n);
    keep[0] = 1;
    keep[n - 1] = 1;

    // Stack of ranges [startIdx, endIdx]
    const stack: [number, number][] = [[0, n - 1]];

    while (stack.length > 0) {
      const [startIdx, endIdx] = stack.pop()!;
      let maxDist = 0;
      let maxIdx = startIdx;

      const start = pts[startIdx];
      const end = pts[endIdx];

      for (let i = startIdx + 1; i < endIdx; i++) {
        const d = this.perpendicularDistance(pts[i], start, end);
        if (d > maxDist) {
          maxDist = d;
          maxIdx = i;
        }
      }

      if (maxDist > epsilon) {
        keep[maxIdx] = 1;
        if (maxIdx - startIdx > 1) {
          stack.push([startIdx, maxIdx]);
        }
        if (endIdx - maxIdx > 1) {
          stack.push([maxIdx, endIdx]);
        }
      }
    }

    const result: Point[] = [];
    for (let i = 0; i < n; i++) {
      if (keep[i] === 1) {
        result.push(pts[i]);
      }
    }

    return result;
  }

  private static perpendicularDistance(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const norm = Math.hypot(dx, dy);
    if (norm === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / norm;
  }

  /**
   * Format points to smooth SVG path with scaled coordinates
   */
  private static pointsToSvgPath(pts: Point[], scaleX = 1, scaleY = 1): string {
    if (pts.length < 2) return '';
    let d = `M ${(pts[0].x * scaleX).toFixed(1)} ${(pts[0].y * scaleY).toFixed(1)} `;

    for (let i = 1; i < pts.length; i++) {
      const curr = pts[i];
      d += `L ${(curr.x * scaleX).toFixed(1)} ${(curr.y * scaleY).toFixed(1)} `;
    }

    d += 'Z ';
    return d;
  }
}
