import type { PrintPreset } from '../types';
import { FreeFaceDetectClient, type DetectedFace } from '../services/free-face-detect-client';
import { IdPhotoCropper } from './id-photo-cropper';
import { FaceSafetyChecker } from './face-safety-checker';
import { createImageData } from './image-data-factory';

export interface IdPhotoAutoCropResult {
  image: ImageData;
  /** Summary for the user (face found + leveling, or the centre-crop fallback). */
  message: string;
  /** Background / head-margin heuristics that failed, if any. */
  warnings: string[];
}

/** The YuNet service rejects inputs over ~4 MP (docker/zero-dce/server.py MAX_INPUT_PIXELS). */
const DETECT_MAX_PIXELS = 3_500_000;

/**
 * 2 吋證件照 auto-crop on the SOURCE image (2026-09-26). This used to run in main.ts on the processed
 * image, only after a preset-button click: any other re-run brought the uncropped image back, the
 * DPI/score still described the uncropped frame, and face detection on the upscaled image exceeded the
 * YuNet size cap, so large photos fell back to a centre crop. The pipeline now calls this before
 * upscaling (so the upscale factor and score use the cropped size) and on every run.
 *
 * Detection runs on a downscaled copy when the source is large; the face box and landmarks are mapped
 * back before leveling/cropping at full resolution. See id-photo-cropper.ts for what the crop is (an
 * estimate to check against the official sample, not a compliance guarantee).
 */
export async function autoCropIdPhoto(src: ImageData, preset: PrintPreset): Promise<IdPhotoAutoCropResult> {
  const warnings: string[] = [];
  const factor = Math.max(1, Math.sqrt((src.width * src.height) / DETECT_MAX_PIXELS));
  const probe = factor > 1 ? boxDownsample(src, factor) : src;
  const detection = await FreeFaceDetectClient.detect(probe);

  let crop: { x: number; y: number; width: number; height: number } | undefined;
  let sourceForCrop = src;
  let leveledFace: DetectedFace | undefined;
  let message = '';

  if (detection.available && detection.faces.length > 0) {
    const best = detection.faces.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
    const leveled = IdPhotoCropper.levelFace(src, scaleFace(best, factor));
    sourceForCrop = leveled.imageData;
    leveledFace = leveled.face;
    const suggestion = IdPhotoCropper.computeCrop(leveled.face, sourceForCrop.width, sourceForCrop.height);
    if (suggestion) {
      crop = suggestion.crop;
      const rotateNote = leveled.angleDegrees !== 0 ? `已自動水平校正 ${Math.abs(leveled.angleDegrees).toFixed(1)}°。` : '';
      message = `✓ 已用 YuNet 自動抓臉置中裁切（估算頭部佔比 ${suggestion.estimatedHeadRatioPercent}%）。${rotateNote}${suggestion.note}`;
    }
  }

  if (!crop) {
    sourceForCrop = src;
    leveledFace = undefined;
    crop = IdPhotoCropper.computeCenterCrop(src.width, src.height);
    message = detection.available
      ? '⚠️ 未偵測到人臉，已改用置中裁切（35×45mm 比例）。送印前務必對照官方範例圖確認。'
      : '⚠️ 人臉偵測無法使用（本機模式或服務離線），已改用置中裁切（35×45mm 比例）。送印前務必對照官方範例圖確認。';
  }

  const image = IdPhotoCropper.applyCrop(sourceForCrop, crop);

  const bg = IdPhotoCropper.checkBackgroundCompliance(image);
  if (!bg.compliant && bg.warning) warnings.push(bg.warning);

  // A face very near the source's own border can force a tighter crop than intended.
  if (leveledFace) {
    const pxPerMm = preset.widthMm > 0 ? image.width / preset.widthMm : preset.targetDpi / 25.4;
    const faceInCrop: DetectedFace = {
      box: { ...leveledFace.box, x: leveledFace.box.x - crop.x, y: leveledFace.box.y - crop.y },
      landmarks: leveledFace.landmarks,
      confidence: leveledFace.confidence
    };
    const margin = FaceSafetyChecker.checkFaceMargin(faceInCrop, image.width, image.height, (preset.safeMarginMm || 5) * pxPerMm);
    if (margin.atRisk && margin.warning) warnings.push(margin.warning);
  }

  return { image, message, warnings };
}

function scaleFace(face: DetectedFace, f: number): DetectedFace {
  if (f === 1) return face;
  const p = ([x, y]: [number, number]): [number, number] => [x * f, y * f];
  return {
    box: { x: face.box.x * f, y: face.box.y * f, width: face.box.width * f, height: face.box.height * f },
    landmarks: {
      rightEye: p(face.landmarks.rightEye),
      leftEye: p(face.landmarks.leftEye),
      nose: p(face.landmarks.nose),
      rightMouth: p(face.landmarks.rightMouth),
      leftMouth: p(face.landmarks.leftMouth)
    },
    confidence: face.confidence
  };
}

function boxDownsample(src: ImageData, factor: number): ImageData {
  const w = Math.max(1, Math.floor(src.width / factor));
  const h = Math.max(1, Math.floor(src.height / factor));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y + 0.5) * factor));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x + 0.5) * factor));
      const i = (sy * src.width + sx) * 4;
      const o = (y * w + x) * 4;
      out[o] = src.data[i];
      out[o + 1] = src.data[i + 1];
      out[o + 2] = src.data[i + 2];
      out[o + 3] = src.data[i + 3];
    }
  }
  return createImageData(out, w, h);
}
