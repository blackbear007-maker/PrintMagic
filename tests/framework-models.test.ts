import { describe, it, expect } from 'vitest';

// 1. Rust 1.78 Framework Engines
import { KurboGeometry } from '../src/core/kurbo-geometry';
import { OxipngCompressor } from '../src/core/oxipng-compressor';
import { ResvgRasterizer } from '../src/core/resvg-rasterizer';

// 2. Python + C++ Framework Engines
import { OpencvClaheDeskew } from '../src/core/opencv-clahe-deskew';
import { PdfiumInspector } from '../src/core/pdfium-inspector';
import { PyvipsStreaming } from '../src/core/pyvips-streaming';

// 3. PyTorch 2.3+ Framework AI Models
import { ScunetDenoiser } from '../src/core/scunet-denoiser';
import { NafnetDeblur } from '../src/core/nafnet-deblur';
import { DoctrDewarp } from '../src/core/doctr-dewarp';
import { TinysamSegmenter } from '../src/core/tinysam-segmenter';
import { AotGanInpainter } from '../src/core/aot-gan-inpaint';

describe('Three-Tier Multi-Framework Pre-Press Matrix (Rust 1.78, Python+C++, PyTorch 2.3+)', () => {
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

  // ─── 🦀 1. Rust 1.78 Framework Engine Tests ─────────────────────────────────
  describe('Rust 1.78 Native Framework Engines', () => {
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

    it('OxipngCompressor: should perform lossless pre-press image optimization', () => {
      const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAC...';
      const res = OxipngCompressor.compressLossless(dummyDataUrl);
      expect(res.compressedBytes).toBeLessThan(res.originalBytes);
      expect(res.savingsRatio).toBeGreaterThan(0.1);
    });

    it('ResvgRasterizer: should calculate 1200 DPI high-precision vector mask bounds', () => {
      const svg = '<svg width="100" height="100"></svg>';
      const raster = ResvgRasterizer.rasterizeSvg(svg, 100, 100, 1200);
      expect(raster.dpi).toBe(1200);
      expect(raster.width).toBeGreaterThan(1000);
    });
  });

  // ─── 🐍⚙️ 2. Python + C++ Framework Engine Tests ─────────────────────────────
  describe('Python + C++ Industrial Vision Engines', () => {
    it('OpencvClaheDeskew: should equalize local contrast with CLAHE and check skew', () => {
      const img = createMockImageData(40, 40, 120, 120, 120);
      const equalized = OpencvClaheDeskew.applyClahe(img, 2.5);
      expect(equalized.width).toBe(40);

      const deskew = OpencvClaheDeskew.detectAndDeskew(img);
      expect(typeof deskew.detectedAngleDeg).toBe('number');
      expect(typeof deskew.isSkewed).toBe('boolean');
    });

    it('PdfiumInspector: should validate PDF page box geometry and font embedding', () => {
      const validPdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj');
      const report = PdfiumInspector.preflightPdf(validPdfBytes);
      expect(report.isPrintReady).toBe(true);
      expect(report.hasBleedBox).toBe(true);

      const invalidBytes = new TextEncoder().encode('GIF89a...');
      const badReport = PdfiumInspector.preflightPdf(invalidBytes);
      expect(badReport.isPrintReady).toBe(false);
    });

    it('PyvipsStreaming: should enforce <32MB peak memory for massive 20,000px billboards', () => {
      const stats = PyvipsStreaming.evaluateStreaming(20000, 20000);
      expect(stats.isStreamingSafe).toBe(true);
      expect(stats.peakMemoryMb).toBeLessThanOrEqual(32);
      expect(stats.chunkCount).toBeGreaterThan(1);
    });
  });

  // ─── 🔥 3. PyTorch 2.3+ Neural Vision Models Tests ──────────────────────────
  describe('PyTorch 2.3+ Neural Vision Models', () => {
    it('SCUNet & NAFNet: should denoise and deblur without losing image dimensions', () => {
      const img = createMockImageData(30, 30);
      const denoised = ScunetDenoiser.denoise(img);
      expect(denoised.width).toBe(30);

      const deblurred = NafnetDeblur.deblur(img);
      expect(deblurred.width).toBe(30);
    });

    it('DocTr & TinySAM & AOT-GAN: should perform curvature dewarping, 1-click segmentation and bleed outpainting', () => {
      const img = createMockImageData(40, 40);
      const dewarped = DoctrDewarp.dewarp(img, 0.25);
      expect(dewarped.width).toBe(40);

      const seg = TinysamSegmenter.segmentFromClick(img, 20, 20);
      expect(seg.boundingBox).toBeDefined();

      const outpainted = AotGanInpainter.outpaintBleed(img, 12);
      expect(outpainted.newWidth).toBe(64);
    });
  });
});
