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

    // 2026-08-28 修正兩個真實問題：(1) 沒有跟 text-inspector.ts 一樣的抽樣 stride，大圖會逐像素全掃
    // （例如 6000×4000 圖片約 2400 萬次亮度計算），改用相同精神的抽樣間隔，大圖效能明顯改善；(2) 沒
    // 檢查 alpha 通道，完全透明像素（常見的 rgb=0,0,0 alpha=0 清空像素）會被誤判成「暗像素」，導致
    // 帶透明背景的圖片（例如去背後的貼紙）出現假的文字區域誤判，跟同目錄下 barcode-verifier.ts 早就
    // 用的 `if (a < 50) continue` 寫法保持一致。
    const stride = Math.max(1, Math.floor(Math.min(w, h) / 250));

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const startX = c * cellW;
        const startY = r * cellH;

        let darkPixels = 0;
        let highEdgeTransitions = 0;
        let sampledPixels = 0;

        for (let y = startY; y < Math.min(h, startY + cellH); y += stride) {
          for (let x = startX; x < Math.min(w, startX + cellW); x += stride) {
            const idx = (y * w + x) * 4;
            if (src[idx + 3] < 50) continue; // transparent — not real dark content

            sampledPixels++;
            const lum = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
            if (lum < 120) darkPixels++;

            const nx = x + stride;
            if (nx < w) {
              const nIdx = idx + stride * 4;
              if (src[nIdx + 3] >= 50) {
                const rightLum = 0.299 * src[nIdx] + 0.587 * src[nIdx + 1] + 0.114 * src[nIdx + 2];
                if (Math.abs(lum - rightLum) > 40) highEdgeTransitions++;
              }
            }
          }
        }

        // Textual stroke density signature (ratio against actually-sampled, non-transparent pixels)
        if (darkPixels > 0 && (darkPixels > sampledPixels * 0.05 || highEdgeTransitions > 0)) {
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
