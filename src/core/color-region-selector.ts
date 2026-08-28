/**
 * 🖱️ Color-Distance Region Selector (~1 KB, pure client-side algorithm)
 *
 * What this actually is:
 * A click-to-select tool for isolating a region (e.g. a watch dial, a logo, a hair mass) for
 * spot-finish plates (foil / UV / emboss / white ink). It is a color-distance flood match around
 * one or more clicked points — not a Segment-Anything model. There is no neural network, no
 * learned weights, and no image understanding beyond per-pixel RGB distance.
 *
 * Good enough for: flat, high-contrast artwork where the target region has a fairly uniform color
 * (logos, solid-color garments, simple icons).
 * Not good for: photographic images with gradients, soft shadows, or ambiguous boundaries — a real
 * segmentation model would be needed for that.
 */

import { createImageData } from './image-data-factory';

export interface RegionSelectPromptPoint {
  x: number;
  y: number;
  isPositive: boolean;
}

export interface ColorRegionSelectResult {
  spotType: 'foil' | 'uv' | 'emboss' | 'white';
  k100MaskData: ImageData;
  contourSvgPath: string;
  coverageMm2: number;
  coveragePercent: number;
  granularityLevel: 'whole' | 'part' | 'subpart';
}

export class ColorRegionSelector {
  /**
   * Selects a region by color-distance flood match from a single click point
   */
  public static segmentObjectAtPoint(
    srcImageData: ImageData,
    clickX: number,
    clickY: number,
    spotType: 'foil' | 'uv' | 'emboss' | 'white' = 'foil',
    tolerance: number = 32
  ): ColorRegionSelectResult {
    return this.segmentWithPrompts(
      srcImageData,
      [{ x: clickX, y: clickY, isPositive: true }],
      spotType,
      tolerance
    );
  }

  /**
   * Selects a region by color-distance flood match from multiple prompt points
   */
  public static segmentWithPrompts(
    srcImageData: ImageData,
    prompts: RegionSelectPromptPoint[],
    spotType: 'foil' | 'uv' | 'emboss' | 'white' = 'foil',
    tolerance: number = 32
  ): ColorRegionSelectResult {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const totalPixels = w * h;

    const maskData = new Uint8ClampedArray(src.length);

    if (prompts.length === 0) {
      prompts.push({ x: Math.floor(w / 2), y: Math.floor(h / 2), isPositive: true });
    }

    const posPrompts = prompts.filter(p => p.isPositive);
    const targetColors = posPrompts.map(p => {
      const idx = (Math.min(h - 1, Math.max(0, p.y)) * w + Math.min(w - 1, Math.max(0, p.x))) * 4;
      return { r: src[idx], g: src[idx + 1], b: src[idx + 2] };
    });

    let matchCount = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const a = src[i + 3];

        if (a < 30) {
          maskData[i] = 255;
          maskData[i + 1] = 255;
          maskData[i + 2] = 255;
          maskData[i + 3] = 0;
          continue;
        }

        // Check distance to any positive prompt target color
        let isMatch = false;
        for (const tc of targetColors) {
          const dR = Math.abs(r - tc.r);
          const dG = Math.abs(g - tc.g);
          const dB = Math.abs(b - tc.b);
          if (Math.sqrt(dR * dR + dG * dG + dB * dB) <= tolerance) {
            isMatch = true;
            break;
          }
        }

        if (isMatch) {
          // 100% Pure Black K100 (Solid plate for hot stamping / spot UV)
          maskData[i] = 0;
          maskData[i + 1] = 0;
          maskData[i + 2] = 0;
          maskData[i + 3] = 255;
          matchCount++;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else {
          maskData[i] = 255;
          maskData[i + 1] = 255;
          maskData[i + 2] = 255;
          maskData[i + 3] = 0;
        }
      }
    }

    const bboxW = Math.max(1, maxX - minX);
    const bboxH = Math.max(1, maxY - minY);
    const contourSvgPath = `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;

    return {
      spotType,
      k100MaskData: createImageData(maskData, w, h),
      contourSvgPath,
      coverageMm2: Number(((bboxW * bboxH * 25.4 * 25.4) / (300 * 300)).toFixed(2)),
      coveragePercent: Number(((matchCount / totalPixels) * 100).toFixed(1)),
      granularityLevel: matchCount < totalPixels * 0.15 ? 'subpart' : matchCount < totalPixels * 0.5 ? 'part' : 'whole'
    };
  }
}
