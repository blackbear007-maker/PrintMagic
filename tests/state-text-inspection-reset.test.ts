import { describe, it, expect } from 'vitest';
import { store } from '../src/ui/state';

describe('StateStore text-inspection result lifecycle', () => {
  const fakeResult = { regions: [], totalWords: 3, typoCount: 1, hasIssues: true, summary: 'x', executionTimeMs: 1 };
  const img = { width: 1, height: 1, data: new Uint8ClampedArray(4) } as unknown as ImageData;

  it('reset() clears a stale text-inspection result', () => {
    store.setTextInspectionResult(fakeResult);
    store.reset();
    expect(store.getState().textInspectionResult).toBeNull();
  });

  it('loading another batch item clears the previous text-inspection result', () => {
    store.setTextInspectionResult(fakeResult);
    store.loadBatchItemIntoActive({
      id: 'b', name: 'b', originalDataUrl: 'data:,', originalImageData: img,
      originalWidth: 1, originalHeight: 1, status: 'idle'
    } as any);
    expect(store.getState().textInspectionResult).toBeNull();
  });
});
