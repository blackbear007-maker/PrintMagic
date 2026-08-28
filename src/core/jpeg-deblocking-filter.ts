/**
 * JPEG Block-Artifact Deblocking Filter
 *
 * Real problem: JPEG's 8x8 DCT block quantization produces visible discontinuities at block
 * boundaries (x,y ≡ 0 mod 8) in heavily-compressed source images — common when users upload a
 * screenshot or a re-saved/re-shared JPEG for print. This targets exactly those boundaries.
 *
 * Honesty note on approach: the textbook reference for this problem is A. Nosratinia's
 * "Denoising of JPEG images by re-application of JPEG" (2001) — shift the image to different
 * 8x8 grid alignments, re-compress+decompress each shift through a real JPEG codec at the
 * original quality, shift back, and average. That is the more faithful reproduction, but it
 * needs a real JPEG encoder round-trip (this app's other filters that touch JPEG re-encoding,
 * e.g. network-guard.ts, do it via the browser's `canvas.toDataURL('image/jpeg', q)`, which is
 * async and only runs in a real browser — untestable in this project's Node-based vitest suite,
 * which has no DOM/canvas). It also needs the original JPEG quality, which isn't recoverable
 * from decoded pixels alone — Nosratinia's own paper doesn't solve that part either.
 *
 * This implementation instead operates directly on decoded RGB pixels: for every 8x8 grid
 * boundary, it measures the discontinuity right at the boundary and compares it against the
 * local gradient activity just inside each neighboring block. A real image edge shows strong
 * gradients throughout the area, not just at the grid line; a quantization artifact shows a
 * sharp jump specifically at x,y ≡ 0 mod 8 while the block interiors on both sides stay flat —
 * that specific signature is what gets smoothed, leaving real content untouched. This is a
 * general boundary-targeted deblocking strategy (the same *category* of technique established
 * by Reeve & Lim, "Reduction of Blocking Effects in Image Coding," Optical Engineering 23(1),
 * 1984 — detect the grid, filter selectively near it) — NOT a reproduction of that paper's exact
 * published filter kernel, which wasn't accessible to verify. Fully deterministic, synchronous,
 * and unit-testable against a synthetic 8x8-blocked test image, unlike the Nosratinia approach.
 */
import { createImageData } from './image-data-factory';

export class JpegDeblockingFilter {
  private static readonly BLOCK_SIZE = 8;

  /**
   * Smooths detected JPEG 8x8 block-boundary artifacts. `strength` in [0, 1] controls how much
   * of the detected artifact jump gets removed; `artifactThreshold` (in 0-255 luminance units)
   * is the minimum boundary jump considered a candidate artifact at all.
   */
  public static deblock(
    imageData: ImageData,
    strength: number = 0.6,
    artifactThreshold: number = 6
  ): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const copy = new Uint8ClampedArray(src.length);
    copy.set(src);
    const output = createImageData(copy, width, height);
    const dst = output.data;

    const B = this.BLOCK_SIZE;
    const s = Math.min(1, Math.max(0, strength));

    // Vertical grid lines (boundary between column bx-1 and bx, for bx = 8, 16, 24, ...)
    for (let bx = B; bx < width; bx += B) {
      for (let y = 0; y < height; y++) {
        for (let c = 0; c < 3; c++) {
          this.smoothBoundary1D(
            src, dst, width, height, y, bx, c, true, artifactThreshold, s
          );
        }
      }
    }

    // Horizontal grid lines (boundary between row by-1 and by, for by = 8, 16, 24, ...)
    for (let by = B; by < height; by += B) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < 3; c++) {
          this.smoothBoundary1D(
            src, dst, width, height, x, by, c, false, artifactThreshold, s
          );
        }
      }
    }

    return output;
  }

  /**
   * Examines one boundary crossing (either a vertical grid line at column `pos`, scanning along
   * row `line`, or a horizontal grid line at row `pos`, scanning along column `line`) for one
   * color channel, and smooths it in `dst` if it looks like a block artifact rather than a real
   * edge. Reads only from `src` (original) so multiple boundary passes don't compound on top of
   * each other's edits.
   */
  private static smoothBoundary1D(
    src: Uint8ClampedArray,
    dst: Uint8ClampedArray,
    width: number,
    height: number,
    line: number,
    pos: number,
    channel: number,
    vertical: boolean,
    artifactThreshold: number,
    strength: number
  ): void {
    // Sample 4 pixels on each side of the boundary: p[-4..-1] before it, p[0..3] after it.
    const size = vertical ? width : height;
    if (pos < 4 || pos > size - 4) return;

    const idxAt = (offset: number): number => {
      const p = pos + offset;
      const x = vertical ? p : line;
      const y = vertical ? line : p;
      return (y * width + x) * 4 + channel;
    };

    const pL3 = src[idxAt(-4)], pL2 = src[idxAt(-3)], pL1 = src[idxAt(-2)], pL0 = src[idxAt(-1)];
    const pR0 = src[idxAt(0)], pR1 = src[idxAt(1)], pR2 = src[idxAt(2)];

    const boundaryJump = Math.abs(pR0 - pL0);
    if (boundaryJump < artifactThreshold) return;

    // Local activity strictly inside each block, NOT crossing the boundary — a real edge shows
    // up here too; a pure quantization artifact leaves these blocks internally flat.
    const insideActivity =
      Math.abs(pL2 - pL3) + Math.abs(pL1 - pL2) + Math.abs(pR1 - pR0) + Math.abs(pR2 - pR1);

    // If the interior is already changing about as much as the boundary jump, this is a real
    // gradient/edge running through the block, not an isolated quantization step — leave it.
    if (insideActivity >= boundaryJump * 0.75) return;

    // Confirmed artifact signature: redistribute the jump with a small tap filter that reduces
    // the discontinuity right at the boundary while decaying to zero by the 2nd pixel out, so
    // block interiors stay untouched. Applied as a delta accumulated onto `dst` (not an absolute
    // value read from `src`) — near a grid corner, both the vertical and horizontal boundary
    // passes touch the same pixel, and accumulating keeps both corrections instead of the later
    // pass silently overwriting the earlier one.
    const correction = (pR0 - pL0) * 0.25 * strength;
    const addAt = (offset: number, weight: number) => {
      const idx = idxAt(offset);
      dst[idx] = Math.min(255, Math.max(0, Math.round(dst[idx] + weight)));
    };
    addAt(-1, correction * 1.0);
    addAt(-2, correction * 0.35);
    addAt(0, -correction * 1.0);
    addAt(1, -correction * 0.35);
  }
}
