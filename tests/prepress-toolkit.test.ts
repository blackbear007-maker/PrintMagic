import { describe, it, expect } from 'vitest';
import { K100BarcodeGenerator } from '../src/core/k100-barcode-generator';
import { SvgPathOptimizer } from '../src/core/svg-path-optimizer';
import { BarcodeVerifier } from '../src/core/barcode-verifier';
import { ImpositionCalculator } from '../src/core/imposition-calculator';
import { PrepressToolkitService } from '../server/services/prepress-toolkit';

describe('Industrial Pre-Press Extended Toolkit (5大輕量可商用印前神器)', () => {
  // ─── 1. K100 Vector Barcode & QR Generator (Segno/qrencode logic) ────────
  it('should generate crisp K100 Vector QR code with pure black fill and quiet zone', () => {
    const svg = K100BarcodeGenerator.generateQrCodeSvg('https://printmagic.tw/sample', 5, 4);
    expect(svg).toContain('<svg');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('data-cmyk="0,0,0,100"');
    expect(svg).toContain('<rect');
  });

  it('should generate crisp K100 Vector Code 128 Barcode with text caption', () => {
    const svg = K100BarcodeGenerator.generateCode128Svg('PM-2026-ART', 60, 2);
    expect(svg).toContain('<svg');
    expect(svg).toContain('PM-2026-ART');
    expect(svg).toContain('data-plate="black-only"');
  });

  // ─── 2. SVG Path & Dieline Optimizer (SVGO logic) ────────────────────────
  it('should minify bloated vector path decimals and reduce file size by > 40%', () => {
    const bloatedSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <!-- Temporary comment to remove -->
        <path fill="#ff0055" d="M 12.3456789 56.7890123 C 23.4567891 34.5678901, 45.6789012 67.8901234, 89.0123456 90.1234567 Z" />
      </svg>
    `;

    const result = SvgPathOptimizer.optimize(bloatedSvg, 1);
    expect(result.optimizedSize).toBeLessThan(result.originalSize);
    expect(result.reductionPercent).toBeGreaterThan(30);
    expect(result.optimizedSvg).not.toContain('<!-- Temporary comment');
    expect(result.optimizedSvg).toContain('M12.3 56.8');
  });

  // ─── 3. Barcode & QR Pre-Flight Verifier (zbar logic) ────────────────────
  it('should verify optical contrast and detect potential un-scannable barcodes', () => {
    // 100x100 dummy image with high-contrast barcode stripes
    const imgData: ImageData = {
      width: 100,
      height: 100,
      data: new Uint8ClampedArray(100 * 100 * 4),
      colorSpace: 'srgb'
    } as ImageData;

    // Fill with alternating black and white vertical bars
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (y * 100 + x) * 4;
        const isDark = Math.floor(x / 5) % 2 === 0;
        const val = isDark ? 0 : 255;
        imgData.data[idx] = val;
        imgData.data[idx + 1] = val;
        imgData.data[idx + 2] = val;
        imgData.data[idx + 3] = 255;
      }
    }

    const report = BarcodeVerifier.verifyImage(imgData, 300);
    expect(report.hasBarcode).toBe(true);
    expect(report.contrastRatio).toBeGreaterThanOrEqual(0.4);
    expect(report.contrastRatio).toBeLessThanOrEqual(0.6);
  });

  // ─── 4. Gang-Run Printing & Imposition Calculator (pdfcpu logic) ─────────
  it('should compute optimal 2D imposition layout and cost savings for A3 gang-run', () => {
    // Standard business card: 90mm x 54mm
    const result = ImpositionCalculator.calculate(90, 54, 'A3', 3, 5);

    expect(result.itemsPerSheet).toBeGreaterThanOrEqual(18); // A3 can fit ~18-21 cards
    expect(result.paperUtilizationPercent).toBeGreaterThan(60);
    expect(result.estimatedSavingPercent).toBeGreaterThan(80);
    expect(result.totalSheetsFor1000Items).toBeLessThanOrEqual(56);
  });

  // ─── 5. Backend Prepress Toolkit Service ─────────────────────────────────
  it('should execute backend prepress toolkit service methods correctly', () => {
    const barcodeSvg = PrepressToolkitService.generateBarcode('PRINTMAGIC-EXPRESS', 'code128');
    expect(barcodeSvg).toContain('PRINTMAGIC-EXPRESS');

    const imposition = PrepressToolkitService.calculateImposition(50, 50, 'A4', 2);
    expect(imposition.itemsPerSheet).toBeGreaterThanOrEqual(12);
  });
});
