import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '../src/ui/state';
import { DropZone } from '../src/ui/dropzone';
import type { BatchItem } from '../src/types';

describe('Batch Processing 20-Image Limit Guard', () => {
  beforeEach(() => {
    store.reset();
  });

  it('should define MAX_BATCH_LIMIT as 20', () => {
    expect(DropZone.MAX_BATCH_LIMIT).toBe(20);
  });

  it('should properly track items in state up to 20 images', () => {
    const dummyImageData = { width: 800, height: 1000, data: new Uint8ClampedArray(800 * 1000 * 4) } as ImageData;

    const mockItems: BatchItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `item-${i + 1}`,
      name: `Artwork_${i + 1}`,
      originalDataUrl: 'data:image/png;base64,dummy',
      originalImageData: dummyImageData,
      originalWidth: 800,
      originalHeight: 1000,
      status: 'idle'
    }));

    store.addBatchItems(mockItems);
    expect(store.getState().batchItems.length).toBe(20);
  });
});
