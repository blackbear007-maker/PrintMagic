import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdPhotoCropper } from '../src/core/id-photo-cropper';
import type { DetectedFace } from '../src/services/free-face-detect-client';

function makeFace(x: number, y: number, width: number, height: number): DetectedFace {
  return {
    box: { x, y, width, height },
    landmarks: {
      rightEye: [x + width * 0.3, y + height * 0.4],
      leftEye: [x + width * 0.7, y + height * 0.4],
      nose: [x + width * 0.5, y + height * 0.6],
      rightMouth: [x + width * 0.35, y + height * 0.8],
      leftMouth: [x + width * 0.65, y + height * 0.8]
    },
    confidence: 0.9
  };
}

describe('IdPhotoCropper (35x45mm 證件照裁切估算，非官方測量)', () => {
  describe('computeCrop', () => {
    it('returns a crop with the 35:45 aspect ratio for a face in the middle of a large image', () => {
      const face = makeFace(400, 300, 200, 250);
      const result = IdPhotoCropper.computeCrop(face, 1200, 1200);

      expect(result).not.toBeNull();
      const { crop } = result!;
      const aspectRatio = crop.width / crop.height;
      expect(aspectRatio).toBeCloseTo(35 / 45, 2);
    });

    it('estimates the head ratio near the middle of the official 70-80% band', () => {
      const face = makeFace(400, 300, 200, 250);
      const result = IdPhotoCropper.computeCrop(face, 1200, 1200);

      expect(result).not.toBeNull();
      expect(result!.estimatedHeadRatioPercent).toBeGreaterThanOrEqual(70);
      expect(result!.estimatedHeadRatioPercent).toBeLessThanOrEqual(80);
    });

    it('returns null for a degenerate (zero-size) face box', () => {
      const face = makeFace(400, 300, 0, 0);
      const result = IdPhotoCropper.computeCrop(face, 1200, 1200);
      expect(result).toBeNull();
    });

    it('clamps the crop to stay within source image bounds when the face is near an edge', () => {
      const face = makeFace(10, 10, 100, 120);
      const result = IdPhotoCropper.computeCrop(face, 400, 400);

      expect(result).not.toBeNull();
      const { crop } = result!;
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.width).toBeLessThanOrEqual(400);
      expect(crop.y + crop.height).toBeLessThanOrEqual(400);
    });

    it('scales the crop down to fit when the ideal crop would exceed the source image', () => {
      const face = makeFace(100, 100, 300, 350); // huge face relative to a small source image
      const result = IdPhotoCropper.computeCrop(face, 500, 500);

      expect(result).not.toBeNull();
      const { crop } = result!;
      expect(crop.width).toBeLessThanOrEqual(500);
      expect(crop.height).toBeLessThanOrEqual(500);
    });

    it('always includes the honesty caveat in its note', () => {
      const face = makeFace(400, 300, 200, 250);
      const result = IdPhotoCropper.computeCrop(face, 1200, 1200);
      expect(result!.note).toContain('對照外交部官方範例圖');
    });
  });

  describe('computeCenterCrop', () => {
    it('returns a crop with the target aspect ratio for a wider-than-target source', () => {
      const crop = IdPhotoCropper.computeCenterCrop(1000, 800);
      expect(crop.width / crop.height).toBeCloseTo(35 / 45, 2);
      expect(crop.height).toBe(800);
      expect(crop.x).toBeGreaterThan(0);
      expect(crop.y).toBe(0);
    });

    it('returns a crop with the target aspect ratio for a taller-than-target source', () => {
      const crop = IdPhotoCropper.computeCenterCrop(400, 1200);
      expect(crop.width / crop.height).toBeCloseTo(35 / 45, 2);
      expect(crop.width).toBe(400);
      expect(crop.y).toBeGreaterThan(0);
      expect(crop.x).toBe(0);
    });
  });

  describe('applyCrop', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('draws the source onto an offscreen canvas and extracts the cropped region', () => {
      const drawImageSpy = vi.fn();
      const putImageDataSpy = vi.fn();
      const getImageDataSpy = vi.fn(() => ({ width: 70, height: 90, data: new Uint8ClampedArray(70 * 90 * 4) }));

      const mockCtx = { drawImage: drawImageSpy, putImageData: putImageDataSpy, getImageData: getImageDataSpy };
      const mockCanvas = { width: 0, height: 0, getContext: vi.fn(() => mockCtx) };

      // @ts-ignore
      global.document = { createElement: vi.fn(() => mockCanvas) } as any;

      const source: ImageData = { width: 400, height: 400, data: new Uint8ClampedArray(400 * 400 * 4), colorSpace: 'srgb' } as ImageData;
      const crop = { x: 50, y: 40, width: 70, height: 90 };

      const result = IdPhotoCropper.applyCrop(source, crop);

      expect(putImageDataSpy).toHaveBeenCalledWith(source, 0, 0);
      expect(drawImageSpy).toHaveBeenCalledWith(mockCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      expect(result.width).toBe(70);
      expect(result.height).toBe(90);
    });
  });

  describe('computeEyeLevelAngle', () => {
    it('returns 0 for a perfectly level eye line', () => {
      const face = makeFace(100, 100, 200, 250);
      face.landmarks.rightEye = [130, 150];
      face.landmarks.leftEye = [230, 150];
      expect(IdPhotoCropper.computeEyeLevelAngle(face)).toBeCloseTo(0, 5);
    });

    it('returns ~10 degrees for eyes tilted at a 10-degree slope', () => {
      const face = makeFace(0, 0, 200, 250);
      // tan(10°) = 0.17633, so dx=100 -> dy=17.633 gives exactly a 10° eye line
      face.landmarks.rightEye = [0, 0];
      face.landmarks.leftEye = [100, 17.633];
      expect(IdPhotoCropper.computeEyeLevelAngle(face)).toBeCloseTo(10, 1);
    });
  });

  describe('levelFace', () => {
    function mockCanvasEnv() {
      const canvases: any[] = [];
      // @ts-ignore
      global.document = {
        createElement: vi.fn(() => {
          const ctx = {
            translate: vi.fn(),
            rotate: vi.fn(),
            drawImage: vi.fn(),
            putImageData: vi.fn(),
            getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
              width: w,
              height: h,
              data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
              colorSpace: 'srgb'
            }))
          };
          const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx), _ctx: ctx };
          canvases.push(canvas);
          return canvas;
        })
      } as any;
      return canvases;
    }

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('skips rotation (returns the same imageData/face) when the eye line is already level', () => {
      mockCanvasEnv();
      const source: ImageData = { width: 200, height: 200, data: new Uint8ClampedArray(200 * 200 * 4), colorSpace: 'srgb' } as ImageData;
      const face = makeFace(50, 50, 100, 125);
      face.landmarks.rightEye = [80, 90];
      face.landmarks.leftEye = [130, 90]; // perfectly level

      const result = IdPhotoCropper.levelFace(source, face);
      expect(result.angleDegrees).toBe(0);
      expect(result.imageData).toBe(source);
      expect(result.face).toBe(face);
    });

    it('skips rotation when the measured tilt is implausibly large (likely a bad detection)', () => {
      mockCanvasEnv();
      const source: ImageData = { width: 200, height: 200, data: new Uint8ClampedArray(200 * 200 * 4), colorSpace: 'srgb' } as ImageData;
      const face = makeFace(50, 50, 100, 125);
      face.landmarks.rightEye = [80, 40];
      face.landmarks.leftEye = [130, 140]; // very steep, > 15°

      const result = IdPhotoCropper.levelFace(source, face);
      expect(result.angleDegrees).toBe(0);
      expect(result.imageData).toBe(source);
    });

    it('rotates the image and keeps a face box centered on the source center still centered on the output canvas', () => {
      mockCanvasEnv();
      const srcW = 200, srcH = 200;
      const source: ImageData = { width: srcW, height: srcH, data: new Uint8ClampedArray(srcW * srcH * 4), colorSpace: 'srgb' } as ImageData;

      // A face box exactly centered on the source image's own center — rotating around that same
      // center should leave its center pinned to the output canvas's center, for any angle.
      const face = makeFace(90, 90, 20, 20);
      face.landmarks.rightEye = [0, 0];
      face.landmarks.leftEye = [100, 17.633]; // ~10° tilt, within the auto-level range

      const result = IdPhotoCropper.levelFace(source, face);

      expect(result.angleDegrees).toBeCloseTo(10, 1);
      expect(result.imageData).not.toBe(source);
      expect(result.imageData.width).toBeGreaterThan(srcW); // output canvas expands to bound the rotated source

      const newCenterX = result.face.box.x + result.face.box.width / 2;
      const newCenterY = result.face.box.y + result.face.box.height / 2;
      expect(newCenterX).toBeCloseTo(result.imageData.width / 2, 0);
      expect(newCenterY).toBeCloseTo(result.imageData.height / 2, 0);
    });
  });

  describe('checkBackgroundCompliance', () => {
    function makeImageWithCorners(width: number, height: number, cornerColor: [number, number, number], centerColor: [number, number, number]): ImageData {
      const data = new Uint8ClampedArray(width * height * 4);
      const cw = Math.round(width * 0.12);
      const ch = Math.round(height * 0.12);
      const isCorner = (x: number, y: number) =>
        (x < cw && y < ch) || (x >= width - cw && y < ch) || (x < cw && y >= height - ch) || (x >= width - cw && y >= height - ch);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const [r, g, b] = isCorner(x, y) ? cornerColor : centerColor;
          data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
        }
      }
      return { width, height, data, colorSpace: 'srgb' } as ImageData;
    }

    it('reports compliant for a clean white background', () => {
      const img = makeImageWithCorners(200, 260, [252, 252, 252], [80, 60, 50]);
      const result = IdPhotoCropper.checkBackgroundCompliance(img);
      expect(result.compliant).toBe(true);
      expect(result.warning).toBeNull();
      expect(result.meanBrightness).toBeGreaterThan(240);
    });

    it('flags a dark background as non-compliant', () => {
      const img = makeImageWithCorners(200, 260, [60, 60, 60], [80, 60, 50]);
      const result = IdPhotoCropper.checkBackgroundCompliance(img);
      expect(result.compliant).toBe(false);
      expect(result.warning).toContain('偏暗');
    });

    it('flags a color-cast (non-neutral) background as non-compliant', () => {
      const img = makeImageWithCorners(200, 260, [250, 200, 120], [80, 60, 50]);
      const result = IdPhotoCropper.checkBackgroundCompliance(img);
      expect(result.compliant).toBe(false);
      expect(result.warning).toContain('色偏');
    });

    it('flags a non-uniform (checkered) background as non-compliant', () => {
      const width = 200, height = 260;
      const data = new Uint8ClampedArray(width * height * 4);
      const cw = Math.round(width * 0.12);
      const ch = Math.round(height * 0.12);
      const isCorner = (x: number, y: number) =>
        (x < cw && y < ch) || (x >= width - cw && y < ch) || (x < cw && y >= height - ch) || (x >= width - cw && y >= height - ch);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (isCorner(x, y)) {
            // Mean brightness stays a comfortable margin above the "too dark" threshold (255/150
            // averages to ~202) so this test isolates the uniformity check specifically, rather
            // than also tripping the brightness check.
            const checker = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0;
            const v = checker ? 255 : 150;
            data[i] = v; data[i + 1] = v; data[i + 2] = v;
          } else {
            data[i] = 80; data[i + 1] = 60; data[i + 2] = 50;
          }
          data[i + 3] = 255;
        }
      }
      const img = { width, height, data, colorSpace: 'srgb' } as ImageData;
      const result = IdPhotoCropper.checkBackgroundCompliance(img);
      expect(result.compliant).toBe(false);
      expect(result.meanBrightness).toBeGreaterThanOrEqual(200); // isolates uniformity from brightness
      expect(result.warning).toContain('不夠均勻');
    });
  });
});
