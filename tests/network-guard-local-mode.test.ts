import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkGuard } from '../src/services/network-guard';
import { store } from '../src/ui/state';
import { FreeFaceDetectClient } from '../src/services/free-face-detect-client';
import { FreeIccClient } from '../src/services/free-icc-client';

function img(): ImageData {
  return { width: 2, height: 2, data: new Uint8ClampedArray(16), colorSpace: 'srgb' } as ImageData;
}

describe('NetworkGuard.isRemoteAllowed (local-mode upload gate)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn(async () => { throw new Error('offline'); });
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    store.setState({ engineMode: 'local' });
  });

  it('is false in local engine mode', () => {
    store.setState({ engineMode: 'local' });
    expect(NetworkGuard.isRemoteAllowed()).toBe(false);
  });

  it('is true in cloud engine mode', () => {
    store.setState({ engineMode: 'cloud' });
    expect(NetworkGuard.isRemoteAllowed()).toBe(true);
  });

  it('face detect and ICC never call fetch in local mode', async () => {
    store.setState({ engineMode: 'local' });
    const face = await FreeFaceDetectClient.detect(img());
    const icc = await FreeIccClient.softProof(img(), new ArrayBuffer(8));
    expect(face.available).toBe(false);
    expect(icc.available).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
