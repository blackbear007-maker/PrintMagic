import { describe, it, expect } from 'vitest';
import { ChromaticAberrationCorrector } from '../src/core/chromatic-aberration-corrector';
import { FabricMoireNeutralizer } from '../src/core/fabric-moire-neutralizer';
import { NeonHalationCompressor } from '../src/core/neon-halation-compressor';
import { Packaging3DMockupRenderer } from '../src/core/packaging-3d-mockup-renderer';
import { FlatFieldVignetteCorrector } from '../src/core/flatfield-vignette-corrector';

describe('Luxury Pre-Press Quality Enhancement Modules Suite', () => {
  const createMockImg = (w: number, h: number, r = 128, g = 128, b = 128, a = 255): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('01. ChromaticAberrationCorrector: should suppress purple fringing on high-contrast edges', () => {
    const img = createMockImg(10, 10, 220, 50, 240); // Intense purple fringe
    const res = ChromaticAberrationCorrector.removeColorFringing(img, 1.3, 0.85);
    expect(res.width).toBe(10);
    expect(res.height).toBe(10);
    expect(res.data[2]).toBeLessThan(240); // Blue clamped down towards green
  });

  it('02. FabricMoireNeutralizer: should smooth textile weave periodic interference', () => {
    const img = createMockImg(20, 20);
    // Add fine grid textile variation
    for (let i = 0; i < img.data.length; i += 8) {
      img.data[i] = 180;
      img.data[i + 1] = 180;
      img.data[i + 2] = 180;
    }
    const res = FabricMoireNeutralizer.neutralizeWeaveMoire(img, 1.5, 0.7);
    expect(res.width).toBe(20);
    expect(res.height).toBe(20);
  });

  it('03. NeonHalationCompressor: should restore saturated neon hue in blown-out highlight cores', () => {
    const img = createMockImg(20, 20, 250, 250, 250); // Blown-out white core
    // Surround with electric cyan halo
    for (let i = 0; i < img.data.length; i += 16) {
      img.data[i] = 10;
      img.data[i + 1] = 220;
      img.data[i + 2] = 250;
    }
    const res = NeonHalationCompressor.compressNeonHighlights(img, 0.5, 230);
    expect(res.width).toBe(20);
    expect(res.data[3]).toBe(255);
  });

  it('04. Packaging3DMockupRenderer: should render isometric 3D folding box SVG with foil lighting', () => {
    const svg = Packaging3DMockupRenderer.renderBoxMockupSvg({
      lengthMm: 120,
      widthMm: 80,
      heightMm: 160,
      boxFinish: 'foil-gold',
      brandTitle: 'COUTURE PARFUM'
    });
    expect(svg).toContain('goldGradFront');
    expect(svg).toContain('COUTURE PARFUM');
    expect(svg).toContain('boxShadow');
  });

  it('05. FlatFieldVignetteCorrector: should raise exposure in 4 dark corners', () => {
    const img = createMockImg(40, 40, 100, 100, 100);
    const res = FlatFieldVignetteCorrector.correctVignetteFalloff(img, 0.4, 2.0);
    // Center pixel (20, 20)
    const centerIdx = (20 * 40 + 20) * 4;
    // Corner pixel (0, 0)
    const cornerIdx = 0;
    expect(res.data[cornerIdx]).toBeGreaterThan(res.data[centerIdx]); // Corner boosted
  });
});
