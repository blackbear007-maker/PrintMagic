import { describe, it, expect, beforeEach } from 'vitest';
import { BleedExpander } from '../src/core/bleed-expander';
import { getPresetById } from '../src/core/presets';
import { SoftCanvas } from './helpers/soft-canvas';

describe('BleedExpander (3mm mirror-extrapolation bleed extension, non-generative)', () => {
  // 2026-09-24：原本這裡的測試整個 canvas 都是 mock，drawImage 什麼都沒畫，所以右／下出血其實是
  // 全透明（translate 起點算錯，鏡像條被畫回原圖範圍又被中心圖蓋掉），它卻一直通過。這裡改用一個
  // 真的會寫入像素的迷你軟體 canvas（支援 translate / ±1 scale / save / restore / drawImage），
  // 直接檢查輸出像素。
  describe('real pixel output (software canvas)', () => {
    beforeEach(() => {
      // @ts-ignore
      global.document = { createElement: () => new SoftCanvas() } as any;
    });

    // R = source x, G = source y — so every output pixel tells us which source pixel it came from.
    const makeCoordImage = (w: number, h: number): ImageData => {
      const img = new ImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          img.data[i] = x; img.data[i + 1] = y; img.data[i + 2] = 0; img.data[i + 3] = 255;
        }
      }
      return img;
    };

    const SRC_W = 120;
    const SRC_H = 80;
    const run = () => {
      const result = BleedExpander.expandBleed(makeCoordImage(SRC_W, SRC_H), getPresetById('postcard'), 2);
      const bx = (result.width - SRC_W) / 2;
      const by = (result.height - SRC_H) / 2;
      const px = (x: number, y: number) => {
        const i = (y * result.width + x) * 4;
        return { r: result.imageData.data[i], g: result.imageData.data[i + 1], a: result.imageData.data[i + 3] };
      };
      return { result, bx, by, px };
    };

    it('leaves no transparent pixel anywhere — all four bleed edges are filled', () => {
      const { result } = run();
      const d = result.imageData.data;
      let transparent = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 255) transparent++;
      expect(transparent).toBe(0);
    });

    it('fills each bleed strip with the mirror image of the adjacent source edge', () => {
      const { bx, by, px } = run();
      const j = 10; // deeper than the seam-healing radius (5px here), so values are the raw mirror
      const midX = bx + SRC_W / 2;
      const midY = by + SRC_H / 2;

      expect(px(bx - 1 - j, midY).r).toBe(j); // left
      expect(px(bx + SRC_W + j, midY).r).toBe(SRC_W - 1 - j); // right
      expect(px(midX, by - 1 - j).g).toBe(j); // top
      expect(px(midX, by + SRC_H + j).g).toBe(SRC_H - 1 - j); // bottom
    });
  });

  describe('healSeamBoundaries — symmetric raised-cosine hump centered on the seam (2026-08-29 fix)', () => {
    // Layout: 40x40 canvas, real content occupies x:[10,30) y:[10,30) filled with color A (200),
    // everything outside (the bleed area) filled with a starkly different color B (50) — a
    // deliberately harsh boundary the seam healing is supposed to smooth.
    const W = 40, H = 40, BX = 10, BY = 10, SW = 20, SH = 20, RADIUS = 5;
    const COLOR_A = 200; // real content
    const COLOR_B = 50; // bleed area

    const makeTestImage = (): ImageData => {
      const data = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = (y * W + x) * 4;
          const isContent = x >= BX && x < BX + SW && y >= BY && y < BY + SH;
          const v = isContent ? COLOR_A : COLOR_B;
          data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
        }
      }
      return { width: W, height: H, data, colorSpace: 'srgb' } as ImageData;
    };

    const pixelAt = (img: ImageData, x: number, y: number) => img.data[(y * W + x) * 4];

    it('blends the two rows immediately straddling the seam most strongly toward each other', () => {
      // The mirror formula (mirrorY = seamY - (y - seamY)) makes row `seamY` itself a trivial
      // self-mirror (mirrorY === y there), so it never changes regardless of the blend formula —
      // the real boundary is between the two adjacent rows it separates, BY-1 (bleed) and BY+1
      // (content), which mirror onto each other.
      const img = makeTestImage();
      (BleedExpander as any).healSeamBoundaries(img, BX, BY, SW, SH, RADIUS);
      const bleedRow = pixelAt(img, 20, BY - 1); // was B=50
      const contentRow = pixelAt(img, 20, BY + 1); // was A=200
      // At distance=1 (close to the seam), blend strength is high — both rows should land
      // noticeably closer to the 125 midpoint than to their own original value.
      expect(Math.abs(bleedRow - COLOR_B)).toBeGreaterThan(Math.abs(bleedRow - 125));
      expect(Math.abs(contentRow - COLOR_A)).toBeGreaterThan(Math.abs(contentRow - 125));
    });

    it('leaves pixels at the far edge of the healing band (radius px away) unchanged', () => {
      const img = makeTestImage();
      const before = pixelAt(img, 20, BY - RADIUS); // deep bleed side, exactly `radius` px from seam
      (BleedExpander as any).healSeamBoundaries(img, BX, BY, SW, SH, RADIUS);
      const after = pixelAt(img, 20, BY - RADIUS);
      expect(after).toBe(before); // seamBlend=1.0 at t=1 -> fully own value, no change
    });

    it('applies the same blend strength symmetrically on both sides of the seam', () => {
      const img = makeTestImage();
      (BleedExpander as any).healSeamBoundaries(img, BX, BY, SW, SH, RADIUS);
      // 2px into the bleed side and 2px into the content side are equidistant from the seam.
      const bleedSide = pixelAt(img, 20, BY - 2); // was B=50, blended toward A
      const contentSide = pixelAt(img, 20, BY + 2); // was A=200, blended toward B
      // Both should have moved the same distance from their original value toward the midpoint (125),
      // since seamBlend depends only on |distance from seam|, not direction.
      expect(Math.abs(bleedSide - 125)).toBe(Math.abs(contentSide - 125));
    });

    it('monotonically reduces blending as distance from the seam increases (real hump, not a one-directional ramp)', () => {
      const img = makeTestImage();
      (BleedExpander as any).healSeamBoundaries(img, BX, BY, SW, SH, RADIUS);
      // On the bleed side, pixels closer to the seam should be pulled further from their original
      // B=50 value than pixels farther away — i.e. the effect fades with distance, not a one-
      // directional ramp like the old buggy formula.
      const closest = pixelAt(img, 20, BY - 1); // distance 1
      const near = pixelAt(img, 20, BY - 2); // distance 2
      const far = pixelAt(img, 20, BY - RADIUS); // distance 5 (radius)
      expect(Math.abs(closest - COLOR_B)).toBeGreaterThan(Math.abs(near - COLOR_B));
      expect(Math.abs(near - COLOR_B)).toBeGreaterThan(Math.abs(far - COLOR_B));
      expect(far).toBe(COLOR_B); // unchanged at the far edge
    });
  });

  describe('healCorners — blend strength is strongest at the corner seam, fading with distance (2026-08-29 fix)', () => {
    const W = 40, H = 40, BX = 10, BY = 10, SW = 20, SH = 20, RADIUS = 5;
    const COLOR_A = 200;
    const COLOR_B = 50;

    const makeTestImage = (): ImageData => {
      const data = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = (y * W + x) * 4;
          const isContent = x >= BX && x < BX + SW && y >= BY && y < BY + SH;
          const v = isContent ? COLOR_A : COLOR_B;
          data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
        }
      }
      return { width: W, height: H, data, colorSpace: 'srgb' } as ImageData;
    };

    const pixelAt = (img: ImageData, x: number, y: number) => img.data[(y * W + x) * 4];

    it('pulls pixels near the top-left corner seam further toward the reference than pixels deep in the bleed corner', () => {
      const img = makeTestImage();
      const nearCornerBefore = pixelAt(img, BX - 1, BY - 1); // 1px from the corner seam
      const farCornerBefore = pixelAt(img, 0, 0); // deepest bleed corner, `radius` px away
      (BleedExpander as any).healCorners(img, BX, BY, SW, SH, RADIUS);
      const nearCornerAfter = pixelAt(img, BX - 1, BY - 1);
      const farCornerAfter = pixelAt(img, 0, 0);

      // Both start at COLOR_B; the reference (content corner pixel) is COLOR_A. Near the seam,
      // blend strength should be high (moves further toward A); far away it should be ~0 (near B).
      expect(Math.abs(nearCornerAfter - nearCornerBefore)).toBeGreaterThan(
        Math.abs(farCornerAfter - farCornerBefore)
      );
    });
  });
});
