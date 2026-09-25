import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeVectorizeClient } from '../src/services/free-vectorize-client';
import { store } from '../src/ui/state';

describe('FreeVectorizeClient (VTracer Rust 微服務與本機三次貝茲曲線雙通道)', () => {
  let storeMock: Record<string, string> = {};

  beforeEach(() => {
    // 遠端服務只在自建服務模式啟用（本機模式不上傳圖片），且 /api/health 最近一次回報 vtracer 在線
    // （2026-09-26 起回報離線的服務會直接跳過）。
    store.setState({ engineMode: 'cloud', remoteServices: { vision: true, vectorize: true }, remoteCheckedAt: Date.now() });
    vi.restoreAllMocks();
    storeMock = {};

    // @ts-ignore
    global.localStorage = {
      getItem: (k: string) => storeMock[k] || null,
      setItem: (k: string, v: string) => { storeMock[k] = v; },
      removeItem: (k: string) => { delete storeMock[k]; },
      clear: () => { storeMock = {}; }
    } as any;

    FreeVectorizeClient.clearCache();
  });

  // Mock a simple 10x10 ImageData
  const dummyImageData: ImageData = {
    width: 10,
    height: 10,
    data: new Uint8ClampedArray(10 * 10 * 4).fill(128),
    colorSpace: 'srgb'
  } as ImageData;

  it('should fall back to local Cubic Bézier engine in local engine mode', async () => {
    store.setState({ engineMode: 'local' });

    const res = await FreeVectorizeClient.vectorizeImage(dummyImageData, 8, 1.5);
    expect(res.isCloud).toBe(false);
    expect(res.engineName).toContain('本機三次貝茲曲線');
    expect(res.svg).toContain('<svg');
  });

  it('should call VTracer backend and parse SVG result when service is online', async () => {
    const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L10,10" /></svg>';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        svg: mockSvg,
        elapsed_ms: 45
      })
    } as any);

    // @ts-ignore
    global.document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 10,
            height: 10,
            getContext: () => ({
              putImageData: vi.fn()
            }),
            toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          };
        }
        return {};
      }
    } as any;

    const res = await FreeVectorizeClient.vectorizeImage(dummyImageData, 8, 1.5);
    expect(res.svg).toBe(mockSvg);
    expect(res.isCloud).toBe(true);
    expect(res.engineName).toContain('VTracer');
  });

  it('should fall back gracefully to local engine if VTracer microservice is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('VTracer 503 Service Unavailable'));

    const res = await FreeVectorizeClient.vectorizeImage(dummyImageData, 8, 1.5);
    expect(res.isCloud).toBe(false);
    expect(res.engineName).toContain('本機三次貝茲曲線');
    expect(res.svg).toContain('<svg');
  });
});
