import smartcrop from 'smartcrop';
import { FreeFaceDetectClient } from './free-face-detect-client';

/**
 * Smart Crop / Composition Suggestion Client
 *
 * Added 2026-08-27. Wraps the real jwagner/smartcrop.js library (MIT) directly rather than
 * reimplementing its saliency-based crop-scoring algorithm — this is not a neural network, it's a
 * real, established (13k+ stars) deterministic algorithm: edge/skin-tone/saturation region
 * detection + sliding-window candidate ranking, running entirely client-side with zero server
 * round-trip and zero added container memory.
 *
 * Best-effort face-aware boosting: smartcrop.js's own docs note it accepts a `boost` list of
 * regions (e.g. "detected faces") to weight toward, so detected faces are fed in from the
 * self-hosted YuNet client when available, so a suggested crop is less likely to cut a face off.
 * If YuNet is offline or Privacy Shield is active, this still works fine without face awareness
 * — the underlying saliency algorithm degrades gracefully with an empty boost list.
 */
export interface SmartCropResult {
  crop: { x: number; y: number; width: number; height: number };
  usedFaceBoost: boolean;
  engine: string;
}

export class SmartCropClient {
  public static async suggestCrop(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ): Promise<SmartCropResult> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context creation failed');
    }
    ctx.putImageData(imageData, 0, 0);

    let boost: { x: number; y: number; width: number; height: number; weight: number }[] = [];
    let usedFaceBoost = false;
    try {
      const faceResult = await FreeFaceDetectClient.detect(imageData);
      if (faceResult.available && faceResult.faces.length > 0) {
        boost = faceResult.faces.map((f) => ({
          x: f.box.x,
          y: f.box.y,
          width: f.box.width,
          height: f.box.height,
          weight: 1.0
        }));
        usedFaceBoost = true;
      }
    } catch {
      // Face detection is optional; smartcrop still works without it.
    }

    const result = await smartcrop.crop(canvas, {
      width: targetWidth,
      height: targetHeight,
      boost
    });

    return {
      crop: result.topCrop,
      usedFaceBoost,
      engine: usedFaceBoost ? 'smartcrop.js + YuNet 人臉加權' : 'smartcrop.js'
    };
  }
}
