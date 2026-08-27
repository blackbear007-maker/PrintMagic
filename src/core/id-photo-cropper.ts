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
 *
 * Added 2026-08-27: two more checks built on the same YuNet detection, both deterministic
 * (no extra model calls):
 * - `levelFace()` — auto-rotates the source image so the detected eye line is horizontal, using
 *   YuNet's own 5-point landmarks (already returned by the detector, previously unused by this
 *   module). Skips rotation for a negligible (<0.5°) or implausibly large (>15°, likely a bad
 *   detection rather than a real tilt) angle — see the constants below.
 * - `checkBackgroundCompliance()` — a real but limited heuristic (corner-sampling brightness /
 *   color-neutrality / uniformity check), not an official verification. See its own doc comment
 *   for exactly what it can and can't catch.
 */

export interface IdPhotoCropResult {
  crop: { x: number; y: number; width: number; height: number };
  estimatedHeadRatioPercent: number;
  note: string;
}

export interface LevelFaceResult {
  imageData: ImageData;
  face: DetectedFace; // box + landmarks re-expressed in the rotated image's coordinate space
  angleDegrees: number; // rotation actually applied (0 if skipped — already level or out of the safety range)
}

export interface BackgroundComplianceResult {
  compliant: boolean;
  meanBrightness: number; // 0-255, sampled from the 4 corners
  colorCastDelta: number; // max |channel - channel| among R/G/B means, 0 = perfectly neutral
  uniformityStdDev: number; // luminance std dev across sampled pixels, 0 = perfectly flat
  warning: string | null;
}

const HAIR_ALLOWANCE_RATIO = 0.25; // estimated crown sits this many face-box-heights above the detected box's top edge
const TARGET_HEAD_FRAME_RATIO = 0.75; // aim for estimated head height ≈ 75% of the output frame (middle of the official 70-80% band)
const TOP_MARGIN_SHARE = 0.4; // of the leftover (non-head) vertical space, this fraction goes above the head, the rest below (for shoulders)

// Below this, the eye line is close enough to level that rotating would just introduce
// interpolation blur for no visible benefit. Above the max, treat it as a likely landmark
// mis-detection rather than a real head tilt — auto-"correcting" a bad detection by rotating the
// whole photo would make things worse, not better, so this leaves the image untouched instead.
const MIN_AUTO_LEVEL_DEGREES = 0.5;
const MAX_AUTO_LEVEL_DEGREES = 15;

// Background compliance heuristic thresholds — deliberately loose (this is a "catch obvious
// problems" check, not a precise colorimetric measurement): a plain white/light wall under normal
// indoor lighting easily clears these; a colored wall, outdoor background, or visible shadow/
// texture should trip at least one.
const BG_SAMPLE_CORNER_RATIO = 0.12; // sample this fraction of width/height from each corner
const BG_MIN_BRIGHTNESS_255 = 200;
const BG_MAX_COLOR_CAST = 25;
const BG_MAX_UNIFORMITY_STDDEV = 20;

export class IdPhotoCropper {
  /**
   * Angle (degrees) of the eye line relative to horizontal, from YuNet's own 5-point landmarks.
   * 0 = level. Sign/magnitude only — which landmark is "left"/"right" doesn't affect the result,
   * since this just measures the tilt of the line between the two points.
   */
  public static computeEyeLevelAngle(face: DetectedFace): number {
    const [rx, ry] = face.landmarks.rightEye;
    const [lx, ly] = face.landmarks.leftEye;
    return Math.atan2(ly - ry, lx - rx) * (180 / Math.PI);
  }

  /**
   * Rotates the image so the detected eye line becomes horizontal — official ID photo rules
   * require an upright, level head, and a phone photo taken with even a slight head tilt or
   * camera tilt will otherwise carry that tilt straight into the final crop. Skipped (returns the
   * input unchanged, angleDegrees: 0) when the tilt is negligible (<0.5°) or implausibly large
   * (>15°, more likely a landmark mis-detection than a real pose) — see the constants above.
   *
   * The face box and landmarks are transformed through the exact same rotation matrix used for
   * the pixels (not re-detected), so the result is deterministic and doesn't depend on YuNet
   * finding the same face twice. The output canvas is sized to bound the whole rotated source
   * image (not cropped to the original frame), so no corner content is lost — computeCrop()
   * called afterward on the returned face box handles picking the final 35:45 region.
   */
  public static levelFace(source: ImageData, face: DetectedFace): LevelFaceResult {
    const angleDeg = this.computeEyeLevelAngle(face);
    if (Math.abs(angleDeg) < MIN_AUTO_LEVEL_DEGREES || Math.abs(angleDeg) > MAX_AUTO_LEVEL_DEGREES) {
      return { imageData: source, face, angleDegrees: 0 };
    }

    const rad = -angleDeg * (Math.PI / 180); // rotate opposite to the measured tilt to level it
    const { width: srcW, height: srcH } = source;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcW;
    srcCanvas.height = srcH;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) throw new Error('Canvas 2D context creation failed');
    srcCtx.putImageData(source, 0, 0);

    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const outW = Math.ceil(srcW * cos + srcH * sin);
    const outH = Math.ceil(srcW * sin + srcH * cos);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) throw new Error('Canvas 2D context creation failed');

    outCtx.translate(outW / 2, outH / 2);
    outCtx.rotate(rad);
    outCtx.translate(-srcW / 2, -srcH / 2);
    outCtx.drawImage(srcCanvas, 0, 0);

    const rotatedImageData = outCtx.getImageData(0, 0, outW, outH);

    const transformPoint = (x: number, y: number): [number, number] => {
      const dx = x - srcW / 2;
      const dy = y - srcH / 2;
      return [
        dx * Math.cos(rad) - dy * Math.sin(rad) + outW / 2,
        dx * Math.sin(rad) + dy * Math.cos(rad) + outH / 2
      ];
    };

    const { x: fx, y: fy, width: fw, height: fh } = face.box;
    const corners = [
      transformPoint(fx, fy),
      transformPoint(fx + fw, fy),
      transformPoint(fx, fy + fh),
      transformPoint(fx + fw, fy + fh)
    ];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const newBox = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };

    return {
      imageData: rotatedImageData,
      face: {
        box: newBox,
        landmarks: {
          rightEye: transformPoint(...face.landmarks.rightEye),
          leftEye: transformPoint(...face.landmarks.leftEye),
          nose: transformPoint(...face.landmarks.nose),
          rightMouth: transformPoint(...face.landmarks.rightMouth),
          leftMouth: transformPoint(...face.landmarks.leftMouth)
        },
        confidence: face.confidence
      },
      angleDegrees: angleDeg
    };
  }

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
   * Heuristic check of whether the background looks like it meets the official "白色背景"
   * requirement — samples the four corners of the (already-cropped) ID photo, since those are
   * reliably background in a well-centered crop, and checks brightness / color neutrality /
   * uniformity. This is a heuristic, not a compliance guarantee: it only samples the corners, so
   * a very tight crop, an off-center subject, or a background that's clean at the corners but
   * has a stray object elsewhere in frame could all fool it. Treat a "compliant" result as "no
   * obvious problem found", not as an official pass — the module's existing honesty note about
   * head-ratio estimation applies here too.
   */
  public static checkBackgroundCompliance(imageData: ImageData): BackgroundComplianceResult {
    const { width, height, data } = imageData;
    const cw = Math.max(1, Math.round(width * BG_SAMPLE_CORNER_RATIO));
    const ch = Math.max(1, Math.round(height * BG_SAMPLE_CORNER_RATIO));

    const regions = [
      { x0: 0, y0: 0, x1: cw, y1: ch },
      { x0: width - cw, y0: 0, x1: width, y1: ch },
      { x0: 0, y0: height - ch, x1: cw, y1: height },
      { x0: width - cw, y0: height - ch, x1: width, y1: height }
    ];

    let count = 0;
    let sumR = 0, sumG = 0, sumB = 0;
    for (const r of regions) {
      for (let y = r.y0; y < r.y1; y++) {
        for (let x = r.x0; x < r.x1; x++) {
          const i = (y * width + x) * 4;
          sumR += data[i];
          sumG += data[i + 1];
          sumB += data[i + 2];
          count++;
        }
      }
    }

    if (count === 0) {
      return { compliant: false, meanBrightness: 0, colorCastDelta: 0, uniformityStdDev: 0, warning: '背景取樣失敗（圖片尺寸過小）。' };
    }

    const meanR = sumR / count, meanG = sumG / count, meanB = sumB / count;
    const meanBrightness = (meanR + meanG + meanB) / 3;
    const colorCastDelta = Math.max(Math.abs(meanR - meanG), Math.abs(meanG - meanB), Math.abs(meanR - meanB));

    let varianceSum = 0;
    for (const r of regions) {
      for (let y = r.y0; y < r.y1; y++) {
        for (let x = r.x0; x < r.x1; x++) {
          const i = (y * width + x) * 4;
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
          varianceSum += (lum - meanBrightness) ** 2;
        }
      }
    }
    const uniformityStdDev = Math.sqrt(varianceSum / count);

    const issues: string[] = [];
    if (meanBrightness < BG_MIN_BRIGHTNESS_255) issues.push('背景不夠亮/偏暗');
    if (colorCastDelta > BG_MAX_COLOR_CAST) issues.push('背景有明顯色偏（非中性白）');
    if (uniformityStdDev > BG_MAX_UNIFORMITY_STDDEV) issues.push('背景不夠均勻（可能有陰影、雜物或紋理）');

    const compliant = issues.length === 0;
    return {
      compliant,
      meanBrightness: Math.round(meanBrightness),
      colorCastDelta: Math.round(colorCastDelta),
      uniformityStdDev: Math.round(uniformityStdDev),
      warning: compliant
        ? null
        : `⚠️ 背景可能不符合證件照規定（${issues.join('、')}），僅偵測四角取樣、非完整檢查。建議換乾淨白色背景重拍，或用「髮絲去背」功能替換背景。`
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
