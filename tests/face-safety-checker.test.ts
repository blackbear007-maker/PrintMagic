import { describe, it, expect } from 'vitest';
import { FaceSafetyChecker } from '../src/core/face-safety-checker';
import type { DetectedFace } from '../src/services/free-face-detect-client';

function makeFace(x: number, y: number, width: number, height: number): DetectedFace {
  return {
    box: { x, y, width, height },
    landmarks: {
      rightEye: [x + width * 0.3, y + height * 0.4],
      leftEye: [x + width * 0.7, y + height * 0.4],
      nose: [x + width * 0.5, y + height * 0.6],
      rightMouth: [x + width * 0.35, y + height * 0.8],
      leftMouth: [x + width * 0.65, y + height * 0.8]
    },
    confidence: 0.9
  };
}

describe('FaceSafetyChecker (人臉／出血安全框衝突預警，純幾何檢查)', () => {
  it('reports no risk for a face comfortably inside the safe margin on all sides', () => {
    const face = makeFace(100, 100, 100, 120);
    const result = FaceSafetyChecker.checkFaceMargin(face, 400, 400, 20);
    expect(result.atRisk).toBe(false);
    expect(result.closestEdge).toBeNull();
    expect(result.warning).toBeNull();
  });

  it('flags a face too close to the top edge', () => {
    const face = makeFace(150, 5, 100, 120);
    const result = FaceSafetyChecker.checkFaceMargin(face, 400, 400, 20);
    expect(result.atRisk).toBe(true);
    expect(result.closestEdge).toBe('top');
    expect(result.marginPx).toBe(5);
    expect(result.warning).toContain('上');
  });

  it('flags a face too close to the right edge', () => {
    const face = makeFace(380, 150, 15, 120); // right edge margin = 400 - (380+15) = 5
    const result = FaceSafetyChecker.checkFaceMargin(face, 400, 400, 20);
    expect(result.atRisk).toBe(true);
    expect(result.closestEdge).toBe('right');
  });

  it('flags a face too close to the left edge', () => {
    const face = makeFace(3, 150, 100, 120);
    const result = FaceSafetyChecker.checkFaceMargin(face, 400, 400, 20);
    expect(result.atRisk).toBe(true);
    expect(result.closestEdge).toBe('left');
  });

  it('flags a face too close to the bottom edge', () => {
    const face = makeFace(150, 300, 100, 95); // bottom margin = 400 - (300+95) = 5
    const result = FaceSafetyChecker.checkFaceMargin(face, 400, 400, 20);
    expect(result.atRisk).toBe(true);
    expect(result.closestEdge).toBe('bottom');
  });

  it('reports the single closest edge when multiple are within the margin', () => {
    // Top margin = 3, left margin = 8 -> top should win as the closest
    const face = makeFace(8, 3, 100, 120);
    const result = FaceSafetyChecker.checkFaceMargin(face, 400, 400, 20);
    expect(result.atRisk).toBe(true);
    expect(result.closestEdge).toBe('top');
    expect(result.marginPx).toBe(3);
  });

  it('treats a margin exactly equal to the threshold as not at risk (strict less-than)', () => {
    const face = makeFace(20, 100, 100, 120); // left margin exactly 20
    const result = FaceSafetyChecker.checkFaceMargin(face, 400, 400, 20);
    expect(result.atRisk).toBe(false);
  });
});
