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

describe('NetworkGuard service status (2026-09-26: skip services /api/health reports down)', () => {
  const healthResponse = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  afterEach(() => {
    vi.unstubAllGlobals();
    store.setState({ engineMode: 'local', remoteServices: null, remoteCheckedAt: 0, cloudStatus: 'offline' });
  });

  it('blocks only the service reported down, and never uploads to it', async () => {
    const fetchSpy = vi.fn(async () => { throw new Error('should not be called'); });
    vi.stubGlobal('fetch', fetchSpy);
    store.setState({ engineMode: 'cloud', remoteServices: { vision: false, vectorize: true }, remoteCheckedAt: Date.now() });

    expect(NetworkGuard.isRemoteAllowed()).toBe(false);
    expect(NetworkGuard.isRemoteAllowed('vision')).toBe(false);
    expect(NetworkGuard.isRemoteAllowed('vectorize')).toBe(true);

    const face = await FreeFaceDetectClient.detect(img());
    expect(face.available).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('records per-service status from /api/health', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => healthResponse({ status: 'ok', services: { vision: false, vectorize: true } })));
    store.setState({ engineMode: 'cloud' });

    expect(await NetworkGuard.checkHealth()).toBe(false);
    expect(store.getState().remoteServices).toEqual({ vision: false, vectorize: true });
    expect(store.getState().cloudStatus).toBe('offline');
  });

  it('treats an unreachable backend as every service down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    store.setState({ engineMode: 'cloud' });

    expect(await NetworkGuard.checkHealth()).toBe(false);
    expect(store.getState().remoteServices).toEqual({ vision: false, vectorize: false });
    expect(NetworkGuard.isRemoteAllowed()).toBe(false);
  });

  it('keeps trying services when the backend does not report them (older server)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => healthResponse({ status: 'ok' })));
    store.setState({ engineMode: 'cloud' });

    expect(await NetworkGuard.checkHealth()).toBe(true);
    expect(store.getState().remoteServices).toBeNull();
    expect(NetworkGuard.isRemoteAllowed()).toBe(true);
  });

  it('re-probes only when the last probe is stale, and never in local mode', async () => {
    const fetchSpy = vi.fn(async () => healthResponse({ status: 'ok', services: { vision: true, vectorize: true } }));
    vi.stubGlobal('fetch', fetchSpy);

    store.setState({ engineMode: 'local', remoteCheckedAt: 0 });
    await NetworkGuard.refreshServiceStatus();
    expect(fetchSpy).not.toHaveBeenCalled();

    store.setState({ engineMode: 'cloud', remoteCheckedAt: Date.now() });
    await NetworkGuard.refreshServiceStatus();
    expect(fetchSpy).not.toHaveBeenCalled();

    store.setState({ remoteCheckedAt: Date.now() - 61000 });
    await NetworkGuard.refreshServiceStatus();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().remoteServices).toEqual({ vision: true, vectorize: true });
  });
});
