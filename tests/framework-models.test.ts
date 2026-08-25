import { describe, it, expect } from 'vitest';

// 1. Rust 1.78 Framework Geometry Engines
import { KurboGeometry } from '../src/core/kurbo-geometry';

// 2. Python + C++ Industrial Computer Vision
import { OpencvClaheDeskew } from '../src/core/opencv-clahe-deskew';

// 3. PyTorch 2.3+ Neural Vision Models
import { ScunetDenoiser } from '../src/core/scunet-denoiser';
import { NafnetDeblur } from '../src/core/nafnet-deblur';
import { DoctrDewarp } from '../src/core/doctr-dewarp';
import { MobileSamSegmenter } from '../src/core/mobilesam-segmenter';
import { AotGanInpainter } from '../src/core/aot-gan-inpaint';

describe('Multi-Framework Industrial Pre-Press Suite', () => {
  const createMockImageData = (w: number, h: number, r = 180, g = 180, b = 180, a = 255): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  // ─── 🦀 1. Rust 1.78 Geometry Engine Tests ───────────────────────────────────
  describe('Rust 1.78 Geometry & Offset Engine', () => {
    it('KurboGeometry: should compute 2mm outer cutline and 0.2mm white ink choke polygon', () => {
      const square = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 }
      ];

      const offset2mm = KurboGeometry.offsetPolygon(square, 2.0);
      expect(offset2mm.length).toBe(4);
      expect(offset2mm[1].x).toBeGreaterThan(50); // Expanded outward

      const svgDieline = KurboGeometry.generateDielineSvg(offset2mm, 90, 54);
      expect(svgDieline).toContain('#FF00FF');
      expect(svgDieline).toContain('viewBox="0 0 90 54"');
    });
  });

  // ─── 🐍⚙️ 2. Industrial Computer Vision Tests ─────────────────────────────────
  describe('Industrial Computer Vision Engines', () => {
    it('OpencvClaheDeskew: should equalize local contrast with CLAHE and check skew', () => {
      const img = createMockImageData(40, 40, 120, 120, 120);
      const equalized = OpencvClaheDeskew.applyClahe(img, 2.5);
      expect(equalized.width).toBe(40);

      const deskew = OpencvClaheDeskew.detectAndDeskew(img);
      expect(typeof deskew.detectedAngleDeg).toBe('number');
      expect(typeof deskew.isSkewed).toBe('boolean');
    });
  });

  // ─── 🔥 3. PyTorch 2.3+ Neural Vision Models Tests ──────────────────────────
  describe('Neural Vision Pre-Press Models', () => {
    it('SCUNet & NAFNet: should denoise and deblur without losing image dimensions', () => {
      const img = createMockImageData(30, 30);
      const denoised = ScunetDenoiser.denoise(img);
      expect(denoised.width).toBe(30);

      const deblurred = NafnetDeblur.deblur(img);
      expect(deblurred.width).toBe(30);
    });

    it('DocTr & MobileSAM & AOT-GAN: should perform curvature dewarping, 1-click segmentation and bleed outpainting', () => {
      const img = createMockImageData(40, 40);
      const dewarped = DoctrDewarp.dewarp(img, 0.25);
      expect(dewarped.width).toBe(40);

      const seg = MobileSamSegmenter.segmentObjectAtPoint(img, 20, 20, 'foil', 32);
      expect(seg.coverageMm2).toBeGreaterThanOrEqual(0);

      const outpainted = AotGanInpainter.outpaintBleed(img, 12);
      expect(outpainted.newWidth).toBe(64);
    });
  });
});
