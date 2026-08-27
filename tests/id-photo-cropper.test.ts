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
});
