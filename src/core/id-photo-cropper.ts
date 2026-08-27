import type { DetectedFace } from '../services/free-face-detect-client';

/**
 * 🪪 ID Photo Auto-Crop (35×45mm, real official Taiwan spec)
 *
 * Official source (verified 2026-08-27, 外交部領事事務局 boca.gov.tw/np-16-1.html):
 * photo size 3.5cm × 4.5cm; head length (頭頂至下顎, crown of head to chin) must be
 * 3.2cm-3.6cm, i.e. 70-80% of the photo's 4.5cm height; white background; face centered
 * with shoulders visible.
 *
 * ⚠️ Honesty note on what this can and cannot verify: YuNet (see free-face-detect-client.ts)
 * returns a FACE DETECTION box, which in practice spans roughly eyebrow/forehead to chin — it
 * does NOT include hair, so it is systematically smaller than the official "頭頂至下顎"
 * (crown-of-head-to-chin) measurement the regulation actually specifies. There is no reliable
 * way to measure "top of hair" from a face detector alone (hair volume/style varies enormously
 * person to person). This module therefore does NOT claim to verify official compliance — it
 * only computes a well-centered, reasonably-scaled STARTING crop using a documented estimate
 * (face box assumed ≈ 80% of true head height, targeting the head occupying ~75% of the output
 * frame — the middle of the official 70-80% range). The estimate is deliberately conservative;
 * users should still visually compare against an official example photo before submitting to a
 * passport office, exactly as the UI text calling this module says.
 */

export interface IdPhotoCropResult {
  crop: { x: number; y: number; width: number; height: number };
  estimatedHeadRatioPercent: number;
  note: string;
}

const HAIR_ALLOWANCE_RATIO = 0.25; // estimated crown sits this many face-box-heights above the detected box's top edge
const TARGET_HEAD_FRAME_RATIO = 0.75; // aim for estimated head height ≈ 75% of the output frame (middle of the official 70-80% band)
const TOP_MARGIN_SHARE = 0.4; // of the leftover (non-head) vertical space, this fraction goes above the head, the rest below (for shoulders)

export class IdPhotoCropper {
  /**
   * Computes a suggested 35:45 crop centered on a detected face. Returns null if the face box
   * is degenerate (zero-size) — callers should fall back to a plain center-crop in that case.
   */
  public static computeCrop(
    face: DetectedFace,
    sourceWidth: number,
    sourceHeight: number,
    targetWidthMm: number = 35,
    targetHeightMm: number = 45
  ): IdPhotoCropResult | null {
    const { x: fx, y: fy, width: fw, height: fh } = face.box;
    if (fw <= 0 || fh <= 0) return null;

    const estimatedCrownOffset = fh * HAIR_ALLOWANCE_RATIO;
    const estimatedHeadHeight = fh + estimatedCrownOffset;

    let cropHeight = estimatedHeadHeight / TARGET_HEAD_FRAME_RATIO;
    let cropWidth = cropHeight * (targetWidthMm / targetHeightMm);

    // If the ideal crop would exceed the source image, scale it down to fit (keeping the 35:45
    // aspect ratio) rather than producing an out-of-bounds crop — this means the estimated head
    // ratio will end up smaller than intended for very tightly-cropped or low-res source photos.
    const maxWidthScale = sourceWidth / cropWidth;
    const maxHeightScale = sourceHeight / cropHeight;
    const fitScale = Math.min(1, maxWidthScale, maxHeightScale);
    cropWidth *= fitScale;
    cropHeight *= fitScale;

    const faceCenterX = fx + fw / 2;
    const estimatedCrownY = fy - estimatedCrownOffset * fitScale;

    const headZoneHeight = estimatedHeadHeight * fitScale;
    const leftoverSpace = cropHeight - headZoneHeight;
    const topMargin = leftoverSpace * TOP_MARGIN_SHARE;

    let cropX = faceCenterX - cropWidth / 2;
    let cropY = estimatedCrownY - topMargin;

    // Clamp so the crop rect stays fully inside the source image
    cropX = Math.max(0, Math.min(cropX, sourceWidth - cropWidth));
    cropY = Math.max(0, Math.min(cropY, sourceHeight - cropHeight));

    const estimatedHeadRatioPercent = Math.round((headZoneHeight / cropHeight) * 100);

    return {
      crop: {
        x: Math.round(cropX),
        y: Math.round(cropY),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
      },
      estimatedHeadRatioPercent,
      note: '已自動置中裁切（估算頭部比例，非官方測量）。送印前請務必對照外交部官方範例圖，自行確認頭部比例與背景是否符合規定。'
    };
  }

  /**
   * Plain center-crop to the target aspect ratio, no face assumption — used when YuNet is
   * unavailable or found no face. Still real pixel cropping (not a stretch), just without the
   * face-aware vertical positioning computeCrop() does.
   */
  public static computeCenterCrop(
    sourceWidth: number,
    sourceHeight: number,
    targetWidthMm: number = 35,
    targetHeightMm: number = 45
  ): { x: number; y: number; width: number; height: number } {
    const targetRatio = targetWidthMm / targetHeightMm;
    const sourceRatio = sourceWidth / sourceHeight;

    let cropWidth: number;
    let cropHeight: number;
    if (sourceRatio > targetRatio) {
      cropHeight = sourceHeight;
      cropWidth = cropHeight * targetRatio;
    } else {
      cropWidth = sourceWidth;
      cropHeight = cropWidth / targetRatio;
    }

    return {
      x: Math.round((sourceWidth - cropWidth) / 2),
      y: Math.round((sourceHeight - cropHeight) / 2),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    };
  }

  /**
   * Applies a crop rect to real ImageData via an offscreen canvas — this actually produces new
   * cropped pixel data (unlike CropController's 9-grid anchors, which only ever changed CSS
   * object-position on the preview <img>; the real exported PDF stretches whatever ImageData it's
   * given to fill the target box, so a caller must pre-crop the data itself for the export to
   * reflect the suggested framing).
   */
  public static applyCrop(source: ImageData, crop: { x: number; y: number; width: number; height: number }): ImageData {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = source.width;
    srcCanvas.height = source.height;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) throw new Error('Canvas 2D context creation failed');
    srcCtx.putImageData(source, 0, 0);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = crop.width;
    outCanvas.height = crop.height;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) throw new Error('Canvas 2D context creation failed');
    outCtx.drawImage(srcCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

    return outCtx.getImageData(0, 0, crop.width, crop.height);
  }
}
