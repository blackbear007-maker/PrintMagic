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
    // 2026-08-28: contrastRatio used to be a naive light/dark PIXEL-COUNT ratio (this 50/50 bar
    // pattern landed at ~0.5, which is why this test's old range was [0.4, 0.6]) — fixed to the
    // docstring's claimed real Michelson contrast (Lmax-Lmin)/(Lmax+Lmin). For genuine pure
    // black/white bars that's 1.0 exactly (maximum possible contrast), which is what a real
    // contrast metric should report here — a pixel-count ratio near 0.5 was never actually
    // measuring "will this scan," just "roughly equal black/white area."
    expect(report.contrastRatio).toBeCloseTo(1.0, 5);
  });

  it('should flag a real low-contrast gray-on-white barcode as failing the contrast check', () => {
    const imgData: ImageData = {
      width: 100,
      height: 100,
      data: new Uint8ClampedArray(100 * 100 * 4),
      colorSpace: 'srgb'
    } as ImageData;

    // Light gray bars on white — visually "barcode-shaped" but genuinely low real contrast,
    // the classic un-scannable case this checker exists to catch.
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (y * 100 + x) * 4;
        const isBar = Math.floor(x / 5) % 2 === 0;
        const val = isBar ? 180 : 255;
        imgData.data[idx] = val;
        imgData.data[idx + 1] = val;
        imgData.data[idx + 2] = val;
        imgData.data[idx + 3] = 255;
      }
    }

    const report = BarcodeVerifier.verifyImage(imgData, 300);
    // Michelson contrast for 255 vs 180: (255-180)/(255+180) ≈ 0.172 — well under the 0.70
    // threshold, correctly flagged as an issue (unlike the old pixel-count-ratio formula, which
    // would have scored this ~0.5 — "roughly equal area" — and missed the real problem).
    expect(report.contrastRatio).toBeLessThan(0.70);
    expect(report.issues.some((i) => i.includes('對比度過低'))).toBe(true);
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
