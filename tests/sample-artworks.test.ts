import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SampleArtworks } from '../src/services/sample-artworks';

describe('SampleArtworks Service (FTUX Onboarding)', () => {
  beforeEach(() => {
    // Setup Mock HTMLCanvasElement & 2D Context for node runtime
    const mockCtx = {
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      roundRect: vi.fn(),
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      textAlign: '',
      shadowColor: '',
      shadowBlur: 0
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      toBlob: vi.fn((cb) => {
        const dummyBlob = new Blob(['dummy image data'], { type: 'image/png' });
        cb(dummyBlob);
      })
    };

    // @ts-ignore
    global.document = {
      createElement: vi.fn((tagName: string) => {
        if (tagName === 'canvas') return mockCanvas;
        return {};
      }) as any
    };
  });

  it('should generate anime sticker sample file with valid properties', async () => {
    const file = await SampleArtworks.loadSample('anime');
    expect(file).toBeDefined();
    expect(file.name).toBe('sample-anime-sticker-72dpi.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBeGreaterThan(0);
  });

  it('should generate cyberpunk poster sample file with valid properties', async () => {
    const file = await SampleArtworks.loadSample('cyberpunk');
    expect(file).toBeDefined();
    expect(file.name).toBe('sample-cyberpunk-poster-72dpi.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBeGreaterThan(0);
  });

  it('should generate business card sample file with valid properties', async () => {
    const file = await SampleArtworks.loadSample('card');
    expect(file).toBeDefined();
    expect(file.name).toBe('sample-business-card-72dpi.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBeGreaterThan(0);
  });
});
