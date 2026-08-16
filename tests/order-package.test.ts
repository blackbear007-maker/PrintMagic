import { describe, it, expect } from 'vitest';
import { OrderPackageGenerator } from '../src/core/order-package';
import { PrintPricingEngine } from '../src/core/print-pricing';
import { getPresetById } from '../src/core/presets';
import type { AppState } from '../src/ui/state';

describe('Order Package Generator (PDF + PrintPass + Specs ZIP)', () => {
  const preset = getPresetById('poster-a4');
  const quote = PrintPricingEngine.calculateQuote('gainhow', 'poster-a4', '250g-matte', 50);

  const mockState = {
    currentPreset: preset,
    dpiAnalysis: { currentDpi: 300, targetDpi: 300, scaleFactor: 1, needsUpscale: false, targetWidthPx: 2480, targetHeightPx: 3508 },
    inkAnalysis: { maxTotalInk: 285, averageTotalInk: 210, exceededPixelCount: 0, exceededRatio: 0, limitThreshold: 300, hasOverflow: false },
    scoreResult: { score: 95, verdict: '商業印刷直出級' }
  } as unknown as AppState;

  it('should format clean compliant PDF filenames', () => {
    const filename = OrderPackageGenerator.formatPdfFilename('Dragon_Art', '健豪', preset, '250P頂級雙霧', 50);
    expect(filename).toContain('[健豪]');
    expect(filename).toContain('Dragon_Art');
    expect(filename).toContain('A4');
    expect(filename).toContain('50張');
    expect(filename.endsWith('.pdf')).toBe(true);
  });

  it('should generate detailed PrintPass certification report text', () => {
    const report = OrderPackageGenerator.generatePrintPassReport(mockState, quote);
    expect(report).toContain('PrintPass™ 數位印前品質檢驗報告書');
    expect(report).toContain('Japan Color 2001');
    expect(report).toContain('300 DPI');
    expect(report).toContain('NT$');
  });

  it('should generate quick copyable spec text for LINE / shop notes', () => {
    const spec = OrderPackageGenerator.generateCopyableSpec(mockState, quote);
    expect(spec).toContain('【PrintMagic 送印工單備註');
    expect(spec).toContain('250P 頂級雙面霧膜');
    expect(spec).toContain('50 張');
  });

  it('should assemble a complete ZIP package with all files', async () => {
    const dummyPdfBase64 = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iag==';
    const packageResult = await OrderPackageGenerator.createOrderZip(dummyPdfBase64, mockState, quote, 'Cyberpunk_City');

    expect(packageResult.zipBlob).toBeDefined();
    expect(packageResult.zipBlob.size).toBeGreaterThan(0);
    expect(packageResult.zipFilename).toContain('PrintMagic_送印封包');
    expect(packageResult.pdfFilename).toContain('健豪');
  });
});
