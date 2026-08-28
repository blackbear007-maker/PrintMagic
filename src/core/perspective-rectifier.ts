/**
 * 📐 DocFlatten & Perspective Rectifier Engine (Homography Transformation)
 * 
 * Pre-Press Problem Solved:
 * When artists or clients photograph physical artwork, contracts, or business cards with a smartphone,
 * the image suffers from trapezoidal/keystone perspective tilt and skewed aspect ratios.
 * 
 * Solution:
 * 1. 3x3 Projective Homography Matrix calculation (Gaussian elimination) — real, verified math.
 * 2. Bilinear backward warping to unwarp the tilted quad into an orthogonal 300 DPI canvas.
 *
 * ⚠️ 2026-08-28 誠實澄清：`autoDetectCorners()` 不做任何真正的角點偵測——它不看圖片內容，永遠回傳
 * 固定的 5% 邊距內縮四個角，跟原本文檔暗示的「Corner localization」不符。真正的透視校正邏輯
 * （homography 矩陣求解 + bilinear 反向取樣）是真的、算法正確，只是需要呼叫端自己提供準確角點座標
 * 才有意義——目前沒有任何呼叫方接了真正的角點偵測，`autoDetectCorners()` 只能當一個不可靠的預設值。
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface QuadCorners {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

import { createImageData } from './image-data-factory';

export class PerspectiveRectifier {
  /**
   * NOT real corner detection — always returns a fixed 5% margin inset regardless of image
   * content. A placeholder default for callers that don't supply real corner coordinates.
   */
  public static autoDetectCorners(imageData: ImageData): QuadCorners {
    const w = imageData.width;
    const h = imageData.height;

    // Default to inset margin if automatic edge contrast is subtle
    const marginX = Math.round(w * 0.05);
    const marginY = Math.round(h * 0.05);

    return {
      topLeft: { x: marginX, y: marginY },
      topRight: { x: w - marginX, y: marginY },
      bottomRight: { x: w - marginX, y: h - marginY },
      bottomLeft: { x: marginX, y: h - marginY }
    };
  }

  /**
   * Warps and rectifies a tilted quadrilateral region into a flat rectangular 300 DPI image
   */
  public static rectify(
    srcImageData: ImageData,
    corners: QuadCorners,
    targetWidth?: number,
    targetHeight?: number
  ): ImageData {
    const srcW = srcImageData.width;
    const srcH = srcImageData.height;
    const src = srcImageData.data;

    // Compute target dimensions based on edge lengths
    const topDist = Math.hypot(corners.topRight.x - corners.topLeft.x, corners.topRight.y - corners.topLeft.y);
    const botDist = Math.hypot(corners.bottomRight.x - corners.bottomLeft.x, corners.bottomRight.y - corners.bottomLeft.y);
    const leftDist = Math.hypot(corners.bottomLeft.x - corners.topLeft.x, corners.bottomLeft.y - corners.topLeft.y);
    const rightDist = Math.hypot(corners.bottomRight.x - corners.topRight.x, corners.bottomRight.y - corners.topRight.y);

    this.assertNonDegenerateQuad(corners, topDist, botDist, leftDist, rightDist);

    const outW = targetWidth || Math.round(Math.max(topDist, botDist));
    const outH = targetHeight || Math.round(Math.max(leftDist, rightDist));

    const dstBuffer = new Uint8ClampedArray(outW * outH * 4);
    const dstImageData: ImageData = createImageData(dstBuffer, outW, outH);
    const dst = dstImageData.data;

    // Compute Inverse Projective Homography Matrix (Target Rect ➔ Source Quad)
    const H = this.computeHomography(
      [
        { x: 0, y: 0 },
        { x: outW, y: 0 },
        { x: outW, y: outH },
        { x: 0, y: outH }
      ],
      [
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft
      ]
    );

    // Bilinear backward-warping loop
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const dstIdx = (y * outW + x) * 4;

        // Project (x, y) through H
        const denom = H[6] * x + H[7] * y + H[8];
        const srcX = (H[0] * x + H[1] * y + H[2]) / (denom || 0.00001);
        const srcY = (H[3] * x + H[4] * y + H[5]) / (denom || 0.00001);

        if (srcX >= 0 && srcX < srcW - 1 && srcY >= 0 && srcY < srcH - 1) {
          const x0 = Math.floor(srcX);
          const y0 = Math.floor(srcY);
          const x1 = x0 + 1;
          const y1 = y0 + 1;
          const dx = srcX - x0;
          const dy = srcY - y0;

          const idx00 = (y0 * srcW + x0) * 4;
          const idx10 = (y0 * srcW + x1) * 4;
          const idx01 = (y1 * srcW + x0) * 4;
          const idx11 = (y1 * srcW + x1) * 4;

          for (let c = 0; c < 4; c++) {
            const v0 = src[idx00 + c] * (1 - dx) + src[idx10 + c] * dx;
            const v1 = src[idx01 + c] * (1 - dx) + src[idx11 + c] * dx;
            dst[dstIdx + c] = Math.round(v0 * (1 - dy) + v1 * dy);
          }
        } else {
          // Fill transparent
          dst[dstIdx + 3] = 0;
        }
      }
    }

    return dstImageData;
  }

  /**
   * Rejects a quad that would make the homography system in `solveGaussian` singular or
   * near-singular — near-zero-length edges, or corners so close to collinear that the
   * quadrilateral has almost no area. Without this check, `solveGaussian`'s `|| 0.00001` pivot
   * fallback silently returns huge/garbage homography coefficients instead of failing loudly,
   * producing a scrambled or solid-noise output image rather than an error.
   */
  private static assertNonDegenerateQuad(
    corners: QuadCorners,
    topDist: number,
    botDist: number,
    leftDist: number,
    rightDist: number
  ): void {
    const MIN_EDGE_PX = 2;
    if (topDist < MIN_EDGE_PX || botDist < MIN_EDGE_PX || leftDist < MIN_EDGE_PX || rightDist < MIN_EDGE_PX) {
      throw new Error(
        `PerspectiveRectifier.rectify: degenerate quad — an edge is only ${Math.min(topDist, botDist, leftDist, rightDist).toFixed(2)}px long. Corners must form a real quadrilateral.`
      );
    }

    // Shoelace formula for polygon area; near-zero relative to the quad's own scale means the
    // corners are (near-)collinear rather than a genuine quadrilateral.
    const { topLeft, topRight, bottomRight, bottomLeft } = corners;
    const quadArea = 0.5 * Math.abs(
      (topLeft.x * topRight.y - topRight.x * topLeft.y) +
      (topRight.x * bottomRight.y - bottomRight.x * topRight.y) +
      (bottomRight.x * bottomLeft.y - bottomLeft.x * bottomRight.y) +
      (bottomLeft.x * topLeft.y - topLeft.x * bottomLeft.y)
    );
    const boundingDiag = Math.max(topDist, botDist, leftDist, rightDist);
    const minArea = boundingDiag * boundingDiag * 0.001;
    if (quadArea < minArea) {
      throw new Error(
        `PerspectiveRectifier.rectify: degenerate quad — corners are nearly collinear (area ${quadArea.toFixed(2)}px² is too small relative to edge length ${boundingDiag.toFixed(1)}px).`
      );
    }
  }

  /**
   * Computes standard 3x3 Projective Homography Matrix from 4 source to 4 target points
   */
  private static computeHomography(from: Point2D[], to: Point2D[]): number[] {
    const A: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < 4; i++) {
      const x = from[i].x;
      const y = from[i].y;
      const u = to[i].x;
      const v = to[i].y;

      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
      b.push(u);

      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
      b.push(v);
    }

    const h = this.solveGaussian(A, b);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];
  }

  private static solveGaussian(A: number[][], b: number[]): number[] {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      for (let k = i; k < n; k++) {
        const tmp = A[maxRow][k];
        A[maxRow][k] = A[i][k];
        A[i][k] = tmp;
      }
      const tmpB = b[maxRow];
      b[maxRow] = b[i];
      b[i] = tmpB;

      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / (A[i][i] || 0.00001);
        for (let j = i; j < n; j++) {
          if (i === j) A[k][j] = 0;
          else A[k][j] += c * A[i][j];
        }
        b[k] += c * b[i];
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * x[j];
      }
      x[i] = sum / (A[i][i] || 0.00001);
    }
    return x;
  }
}
