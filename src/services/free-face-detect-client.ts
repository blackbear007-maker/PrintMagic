import { NetworkGuard } from './network-guard';

/**
 * Face Detection Client (self-hosted YuNet only — no local fallback)
 *
 * Added 2026-08-27. Unlike every other Free*Client in this project, there is no local
 * deterministic fallback here: this project has no existing local face-detection algorithm to
 * fall back to, and inventing a fake heuristic (e.g. "assume the face is roughly centered")
 * would misrepresent itself as detection when it isn't — see this project's honesty norms.
 * Callers must handle `available: false` explicitly (e.g. by falling back to a fixed/manual crop
 * assumption in the calling feature), not assume a result is always present.
 *
 * Flow:
 * 1. Privacy Shield active -> skip the network entirely, report unavailable.
 * 2. Otherwise, attempt the self-hosted YuNet microservice (/api/ai/detect-face ->
 *    docker/zero-dce/, real trained Apache-2.0/MIT ONNX weights, auto-downloaded at build time).
 *    Verified 2026-08-27: correctly detected a face on a synthetic shaded test image at 84.2%
 *    confidence, 0.22MB weight, ~78ms CPU inference.
 * 3. Report unavailable if the service is unreachable, unavailable, or the result doesn't come
 *    back successfully.
 */
export interface DetectedFace {
  box: { x: number; y: number; width: number; height: number };
  landmarks: {
    rightEye: [number, number];
    leftEye: [number, number];
    nose: [number, number];
    rightMouth: [number, number];
    leftMouth: [number, number];
  };
  confidence: number;
}

export interface FaceDetectionResult {
  available: boolean;
  faces: DetectedFace[];
  imageWidth?: number;
  imageHeight?: number;
  engine: string;
}

export class FreeFaceDetectClient {
  public static async detect(imageData: ImageData): Promise<FaceDetectionResult> {
    if (NetworkGuard.isPrivacyShieldActive()) {
      return { available: false, faces: [], engine: '100% 本機模式已開啟，人臉偵測功能離線不可用' };
    }

    const cloudResult = await this.tryYuNet(imageData);
    if (cloudResult) return cloudResult;

    return { available: false, faces: [], engine: 'YuNet 服務離線，人臉偵測功能暫時不可用' };
  }

  private static async tryYuNet(imageData: ImageData): Promise<FaceDetectionResult | null> {
    try {
      const dataUrl = this.imageDataToDataUrl(imageData);
      if (!dataUrl) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('/api/ai/detect-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: dataUrl }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success) return null;

      return {
        available: true,
        faces: data.faces || [],
        imageWidth: data.imageWidth,
        imageHeight: data.imageHeight,
        engine: 'YuNet (自建服務)'
      };
    } catch {
      return null;
    }
  }

  private static imageDataToDataUrl(imageData: ImageData): string {
    if (typeof document === 'undefined') return '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }
}
