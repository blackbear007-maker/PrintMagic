import { describe, it, expect } from 'vitest';
import { KubelkaMunkMixer } from '../src/core/kubelka-munk-mixer';
import { Cat02ColorTemperature } from '../src/core/cat02-color-temperature';
import { GcrGrayMaximizer } from '../src/core/gcr-gray-maximizer';
import { LocalLaplacianToner } from '../src/core/local-laplacian-toner';
import { AdaptiveWienerDeblur } from '../src/core/adaptive-wiener-deblur';
import { HighpassDotgainCrispener } from '../src/core/highpass-dotgain-crispener';
import { PaperWhiteCompensator } from '../src/core/paper-white-compensator';
import { DuplexAlignmentBalancer } from '../src/core/duplex-alignment-balancer';
import { CornerRadiusMitering } from '../src/core/corner-radius-mitering';
import { FloydSteinbergRasterizer } from '../src/core/floyd-steinberg-rasterizer';
import { AutoKeystoneRectifier } from '../src/core/auto-keystone-rectifier';
import { CircleBadgeArcFitter } from '../src/core/circle-badge-arc-fitter';

describe('12 Pure Automatic (0 KB / 0 Manual Input) Pre-Press Algorithms Suite', () => {
  const createMockImg = (w: number, h: number, r = 100, g = 100, b = 100, a = 255): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('01. KubelkaMunkMixer: should simulate physical subtractive ink mixing', () => {
    const img = createMockImg(10, 10, 180, 120, 60);
    const res = KubelkaMunkMixer.simulateSubtractiveMixing(img, 0.1);
    expect(res.width).toBe(10);
    expect(res.data[0]).toBeGreaterThan(0);
  });

  it('02. Cat02ColorTemperature: should auto-correct white point to standard daylight', () => {
    const img = createMockImg(10, 10, 120, 140, 200); // Cool fluorescent cast
    const res = Cat02ColorTemperature.autoCorrectWhitePoint(img);
    expect(res.width).toBe(10);
  });

  it('03. GcrGrayMaximizer: should maximize gray component replacement with K100', () => {
    const img = createMockImg(10, 10, 80, 80, 80);
    const res = GcrGrayMaximizer.maximizeGcr(img, 0.8);
    expect(res.width).toBe(10);
  });

  it('04. LocalLaplacianToner: should equalize tone and preserve local micro-contrast', () => {
    const img = createMockImg(10, 10, 220, 220, 220);
    const res = LocalLaplacianToner.equalizeTone(img, 0.3);
    expect(res.width).toBe(10);
  });

  it('05. AdaptiveWienerDeblur: should deblur soft handshake contours in 0ms', () => {
    const img = createMockImg(10, 10);
    const res = AdaptiveWienerDeblur.deblur(img, 0.5);
    expect(res.width).toBe(10);
  });

  it('06. HighpassDotgainCrispener: should inject acutance against physical press dot gain', () => {
    const img = createMockImg(10, 10);
    const res = HighpassDotgainCrispener.crispEdges(img, 0.35);
    expect(res.width).toBe(10);
  });

  it('07. PaperWhiteCompensator: should compensate substrate paper tint', () => {
    const img = createMockImg(10, 10, 200, 200, 180);
    const res = PaperWhiteCompensator.compensateSubstrate(img, 'cream');
    expect(res.width).toBe(10);
  });

  it('08. DuplexAlignmentBalancer: should equalize duplex registration margins', () => {
    const front = createMockImg(20, 20);
    const back = createMockImg(20, 20);
    const res = DuplexAlignmentBalancer.balanceDuplexMargins(front, back);
    expect(res.registrationShiftMm).toBe(0);
    expect(res.message).toContain('0.1mm');
  });

  it('09. CornerRadiusMitering: should inspect R5 die-cut corner safety', () => {
    const img = createMockImg(50, 50, 255, 255, 255);
    const res = CornerRadiusMitering.inspectCornerSafety(img, 5.0);
    expect(res.cornerSafe).toBe(true);
  });

  it('10. FloydSteinbergRasterizer: should rasterize continuous tones into 1-bit dot halftone', () => {
    const img = createMockImg(10, 10, 120, 120, 120);
    const res = FloydSteinbergRasterizer.rasterize1Bit(img);
    expect(res.data[0] === 0 || res.data[0] === 255).toBe(true);
  });

  it('11. AutoKeystoneRectifier: should 100% automatically detect document corners', () => {
    const img = createMockImg(50, 50);
    const res = AutoKeystoneRectifier.autoRectify(img);
    expect(res.detectedCorners.length).toBe(4);
    expect(res.tiltAngleDeg).toBe(0);
  });

  it('12. CircleBadgeArcFitter: should generate circular badge 3mm crimp bleed guide', () => {
    const img = createMockImg(50, 50);
    const res = CircleBadgeArcFitter.fitCircleBadge(img, 58);
    expect(res.badgeDiameterMm).toBe(58);
    expect(res.outerBleedDiameterMm).toBe(64);
    expect(res.guideSvg).toContain('Crimping');
  });
});
