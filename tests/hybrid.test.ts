import { describe, it, expect } from 'vitest';
import { IccService } from '../server/services/icc-service';
import { PdfxService } from '../server/services/pdfx-service';
import { CloudClient } from '../src/services/cloud-client';
import { store } from '../src/ui/state';

describe('IccService (ISO Color Profiles & Compliance)', () => {
  it('should list all international standard printing profiles', () => {
    const profiles = IccService.listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(4);
    const ids = profiles.map((p) => p.id);
    expect(ids).toContain('japan-color-2001');
    expect(ids).toContain('fogra-39');
    expect(ids).toContain('us-swop-v2');
    expect(ids).toContain('pso-coated-v3');
  });

  it('should correctly validate TAC compliance against profile limit', () => {
    const compliant = IccService.validateTacCompliance(280, 'japan-color-2001');
    expect(compliant.compliant).toBe(true);
    expect(compliant.delta).toBe(0);

    const exceeded = IccService.validateTacCompliance(360, 'japan-color-2001');
    expect(exceeded.compliant).toBe(false);
    expect(exceeded.delta).toBe(10);
  });
});

describe('PdfxService (Industrial PDF/X-1a & PDF/X-4)', () => {
  it('should generate ISO 15930 compliant PDF/X buffer and checksum', async () => {
    const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const result = await PdfxService.generatePdfx({
      imageDataUrl: dummyDataUrl,
      preset: {
        id: 'poster-a4',
        nameZh: 'A4 經典海報',
        widthMm: 210,
        heightMm: 297,
        bleedMm: 3,
        targetDpi: 300,
        cropMarks: true,
        colorBars: true,
        registrationMarks: true
      },
      iccProfileId: 'japan-color-2001',
      pdfStandard: 'PDF/X-1a:2001',
      artworkName: 'TestArtwork'
    });

    expect(result.buffer).toBeDefined();
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.checksum).toMatch(/^PMX-[A-F0-9]{16}$/);
    expect(result.fileName).toContain('PDF_X_1a');
    expect(result.iccName).toBe('Japan Color 2001 Coated');
  });
});

describe('Hybrid Dual-Engine & Fallback Strategy', () => {
  it('should toggle engine mode in state store', () => {
    store.setEngineMode('local');
    expect(store.getState().engineMode).toBe('local');

    const toggled = store.toggleEngineMode();
    expect(toggled).toBe('cloud');
    expect(store.getState().engineMode).toBe('cloud');
  });

  it('should provide default ICC profiles when offline', async () => {
    const profiles = await CloudClient.getIccProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(2);
    expect(profiles[0].id).toBe('japan-color-2001');
  });
});
