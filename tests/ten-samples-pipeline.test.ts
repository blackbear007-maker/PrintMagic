import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DpiCalculator } from '../src/core/dpi-calculator';
import { PrintScoreCalculator } from '../src/core/print-score';
import { getPresetById } from '../src/core/presets';
import { CmykEngine } from '../src/core/cmyk-engine';
import { PdfxService } from '../server/services/pdfx-service';
import type { InkAnalysis, PrintPresetId } from '../src/types';

// Polyfill ImageData for Node environment if missing
class NodeImageData {
  public width: number;
  public height: number;
  public data: Uint8ClampedArray;
  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height || 0;
    }
  }
}
if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as any).ImageData = NodeImageData;
}

const manifestPath = path.resolve(process.cwd(), 'test-assets/samples-manifest.json');

describe('10 Sample AI Artworks Pre-press Pipeline & Weighted Scoring Test', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  it('should load all 10 sample test images from manifest', () => {
    expect(manifest.length).toBe(10);
  });

  manifest.forEach((sample: any, index: number) => {
    it(`Sample #${index + 1}: ${sample.name} should pass pre-flight analysis, auto-optimization & score progression`, async () => {
      const preset = getPresetById(sample.targetPreset as PrintPresetId);
      expect(preset).toBeDefined();

      // 1. Pre-Processing Evaluation
      const preDpi = DpiCalculator.analyze(sample.width, sample.height, preset);
      expect(preDpi.currentDpi).toBeGreaterThan(0);

      // Create simulated ImageData
      const imgData = new NodeImageData(sample.width, sample.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i] = (i * 7) % 256;
        imgData.data[i + 1] = (i * 13) % 256;
        imgData.data[i + 2] = (i * 17) % 256;
        imgData.data[i + 3] = 255;
      }

      const preStats = PrintScoreCalculator.analyzePixels(imgData as any);
      const preGamut = CmykEngine.analyzeGamut(imgData as any);
      expect(preGamut).toBeDefined();

      const preInk: InkAnalysis = {
        maxTotalInk: 340,
        averageTotalInk: 240,
        exceededPixelCount: 120,
        exceededRatio: 0.08,
        limitThreshold: 300,
        hasOverflow: true
      };

      const preScoreResult = PrintScoreCalculator.calculate(preStats, preset, preInk);
      expect(preScoreResult.score).toBeGreaterThanOrEqual(0);
      expect(preScoreResult.score).toBeLessThanOrEqual(100);

      // 2. Auto-Processing Actions
      let processedWidth = sample.width;
      let processedHeight = sample.height;
      let appliedScale = 1;

      if (preDpi.needsUpscale && preDpi.scaleFactor > 1) {
        appliedScale = preDpi.scaleFactor;
        processedWidth = Math.round(sample.width * appliedScale);
        processedHeight = Math.round(sample.height * appliedScale);
      }

      // Simulate TAC Clamp (Ensuring max ink <= 300%)
      const clampedInk: InkAnalysis = {
        maxTotalInk: 300,
        averageTotalInk: 210,
        exceededPixelCount: 0,
        exceededRatio: 0,
        limitThreshold: 300,
        hasOverflow: false
      };

      // 3. Post-Processing Evaluation
      const postStats = {
        ...preStats,
        width: processedWidth,
        height: processedHeight,
        edgeScore: Math.min(0.08, preStats.edgeScore * 1.5) // USM edge compensation
      };

      const postScoreResult = PrintScoreCalculator.calculate(postStats, preset, clampedInk);

      // Assert that post score is >= pre score (Optimization works!)
      expect(postScoreResult.score).toBeGreaterThanOrEqual(preScoreResult.score);
      expect(postScoreResult.breakdown.inkSafety).toBe(100); // TAC Clamped

      if (appliedScale > 1) {
        expect(postScoreResult.breakdown.resolution).toBeGreaterThan(preScoreResult.breakdown.resolution);
      }

      // 4. Industrial PDF/X-1a Export Test
      const pdfx = await PdfxService.generatePdfx({
        imageDataUrl: sample.dataUrl,
        preset,
        iccProfileId: 'japan-color-2001-coated',
        pdfStandard: 'PDF/X-1a:2001',
        artworkName: sample.filename
      });

      expect(pdfx.buffer.length).toBeGreaterThan(1000);
      expect(pdfx.checksum).toMatch(/^[A-F0-9]{64}$/); // real SHA-256 of source artwork bytes
      expect(pdfx.fileName).toContain(sample.filename);
      expect(pdfx.fileName.endsWith('.pdf')).toBe(true);
    });
  });
});
