/**
 * 🧠 Stroke-Density Text Zone Detector (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * A grid-based dark-pixel and edge-transition density scan that flags which cells of an image
 * probably contain text. It does NOT perform character recognition — it cannot tell you what the
 * text says. `zoneLabel` is a placeholder like "[Text Zone R1C3]", not read text. There is no
 * PP-OCR/DBNet/SVTR model here, no license, no accuracy number backing "99.6% precision."
 *
 * There is no OCR in this app (removed 2026-08-26 — it was never wired into any UI feature, and
 * the problem it was meant to solve — reading AI-hallucinated garbled "text" in generated artwork
 * — turns out to be unsolvable by OCR: that "text" is usually not composed of real characters at
 * all, so no OCR engine can meaningfully read it). This detector only exists as a fast, offline
 * "does this artwork have small/illegible text zones" pre-flight check; the actual fix flow is
 * region localization + the human typing the correct text (see src/ui/vector-overlay-modal.ts).
 */

export interface TextZoneBox {
  zoneLabel: string;
  box: { x: number; y: number; width: number; height: number };
  isPrintLegible: boolean;
  warning?: string;
}

export interface TextZoneResult {
  detectedZones: TextZoneBox[];
  totalZones: number;
  preflightPassed: boolean;
}

export class TextZoneDetector {
  /**
   * Flags grid cells likely to contain text, and checks whether they meet a minimum legible height
   */
  public static inspectText(
    srcImageData: ImageData,
    minFontHeightPx: number = 8
  ): TextZoneResult {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const detectedZones: TextZoneBox[] = [];
    let preflightPassed = true;

    // Grid-based dark-pixel / edge-transition density scan
    const gridCols = 8;
    const gridRows = 8;
    const cellW = Math.floor(w / gridCols);
    const cellH = Math.floor(h / gridRows);

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const startX = c * cellW;
        const startY = r * cellH;

        let darkPixels = 0;
        let highEdgeTransitions = 0;

        for (let y = startY; y < Math.min(h, startY + cellH); y++) {
          for (let x = startX; x < Math.min(w, startX + cellW); x++) {
            const idx = (y * w + x) * 4;
            const lum = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
            if (lum < 120) darkPixels++;

            if (x < w - 1) {
              const rightLum = 0.299 * src[idx + 4] + 0.587 * src[idx + 5] + 0.114 * src[idx + 6];
              if (Math.abs(lum - rightLum) > 40) highEdgeTransitions++;
            }
          }
        }

        // Textual stroke density signature
        const cellPixels = (cellW * cellH) / 4;
        if (darkPixels > 0 && (darkPixels > cellPixels * 0.05 || highEdgeTransitions > 0)) {
          const isLegible = cellH >= minFontHeightPx;
          if (!isLegible) preflightPassed = false;

          detectedZones.push({
            zoneLabel: `[Text Zone R${r+1}C${c+1}]`,
            box: { x: startX, y: startY, width: cellW, height: cellH },
            isPrintLegible: isLegible,
            warning: isLegible ? undefined : '字體尺寸過小 (低於 0.25pt 安全印刷閥值)'
          });
        }
      }
    }

    return {
      detectedZones,
      totalZones: detectedZones.length,
      preflightPassed
    };
  }
}
