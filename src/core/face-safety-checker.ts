import type { DetectedFace } from '../services/free-face-detect-client';

/**
 * 🪪 Face vs. Bleed/Safe-Zone Proximity Check
 *
 * Added 2026-08-27. Extends the existing print-safety checks (DPI, TAC, bleed) to a new axis:
 * whenever YuNet has already detected a face for another feature (smart-crop boost or the ID
 * photo auto-crop), this checks whether that face sits inside the print preset's own safe margin
 * — the zone near the trim edge that real-world cutting tolerance can clip. It does NOT run face
 * detection on its own; it's a pure, deterministic geometry check against a face box + image
 * dimensions the caller already has, so it adds no extra network round-trip or cost.
 */
export interface FaceSafetyResult {
  atRisk: boolean;
  closestEdge: 'top' | 'bottom' | 'left' | 'right' | null;
  marginPx: number;
  warning: string | null;
}

const EDGE_LABELS: Record<'top' | 'bottom' | 'left' | 'right', string> = {
  top: '上',
  bottom: '下',
  left: '左',
  right: '右'
};

export class FaceSafetyChecker {
  /**
   * Checks the closest distance from the face's bounding box to any of the four image edges
   * against `safeMarginPx`. `imageWidth`/`imageHeight` should be the dimensions of the SAME
   * image the face box's coordinates are expressed in (e.g. the final print-ready
   * processedImageData) — a mismatch here would silently produce a meaningless result.
   */
  public static checkFaceMargin(
    face: DetectedFace,
    imageWidth: number,
    imageHeight: number,
    safeMarginPx: number
  ): FaceSafetyResult {
    const { x, y, width, height } = face.box;
    const margins: { edge: 'top' | 'bottom' | 'left' | 'right'; value: number }[] = [
      { edge: 'top', value: y },
      { edge: 'left', value: x },
      { edge: 'right', value: imageWidth - (x + width) },
      { edge: 'bottom', value: imageHeight - (y + height) }
    ];
    const closest = margins.reduce((a, b) => (a.value <= b.value ? a : b));
    const atRisk = closest.value < safeMarginPx;

    return {
      atRisk,
      closestEdge: atRisk ? closest.edge : null,
      marginPx: Math.round(closest.value),
      warning: atRisk
        ? `⚠️ 偵測到的人臉距離${EDGE_LABELS[closest.edge]}邊緣過近（僅剩約 ${Math.round(closest.value)}px，安全邊界建議 ${Math.round(safeMarginPx)}px），送印裁切時可能被裁到臉部，建議重新構圖或加大邊界。`
        : null
    };
  }
}
