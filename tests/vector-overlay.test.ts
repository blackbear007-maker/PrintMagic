import { describe, it, expect } from 'vitest';
import { VectorOverlayEngine } from '../src/core/vector-overlay';

describe('VectorOverlayEngine (K100 Pure Black & Vector Logo Overlay)', () => {
  it('should add K100 text item and track items accurately', () => {
    const engine = new VectorOverlayEngine();
    const item = engine.addText({
      text: 'CREATIVE DESIGN STUDIO',
      xPercent: 10,
      yPercent: 80,
      fontSizePx: 42,
      fontFamily: 'sans-serif',
      isK100: true,
      color: '#000000',
      isOverprint: true
    });

    expect(item.id).toBeDefined();
    expect(item.isK100).toBe(true);
    expect(engine.getTextItems().length).toBe(1);

    engine.removeText(item.id);
    expect(engine.getTextItems().length).toBe(0);
  });

  it('should support vector logo overlays', () => {
    const engine = new VectorOverlayEngine();
    const logo = engine.addLogo({
      dataUrl: 'data:image/svg+xml;base64,dummy',
      xPercent: 5,
      yPercent: 5,
      widthPercent: 20,
      heightPercent: 10
    });

    expect(logo.id).toBeDefined();
    expect(engine.getLogoItems().length).toBe(1);
  });

  // 2026-08-28: renderOverlay() used to be synchronous — `new Image(); img.src = dataUrl;`
  // followed immediately by `ctx.drawImage(img, ...)` in the same tick, before the image had any
  // chance to actually decode, so logos silently never appeared in the output. This verifies the
  // fix: drawImage only fires after the (mocked) decode() promise resolves, and a failed decode
  // is skipped gracefully rather than crashing the whole overlay render.
  describe('renderOverlay — async image decode ordering', () => {
    class MockImage {
      src = '';
      private decodeResolve!: () => void;
      private decodeReject!: (e: Error) => void;
      decodePromise: Promise<void>;
      constructor(shouldFail = false) {
        this.decodePromise = new Promise((resolve, reject) => {
          this.decodeResolve = resolve;
          this.decodeReject = reject;
        });
        if (shouldFail) {
          // simulate a corrupt data URL failing to decode, asynchronously
          setTimeout(() => this.decodeReject(new Error('decode failed')), 0);
        }
      }
      decode(): Promise<void> {
        return this.decodePromise;
      }
      resolveDecode(): void {
        this.decodeResolve();
      }
    }

    it('should only draw a logo after its image has finished decoding', async () => {
      const engine = new VectorOverlayEngine();
      engine.addLogo({
        dataUrl: 'data:image/png;base64,dummy',
        xPercent: 0,
        yPercent: 0,
        widthPercent: 10,
        heightPercent: 10
      });

      let mockImg: MockImage | null = null;
      // @ts-ignore
      global.Image = class {
        constructor() {
          mockImg = new MockImage();
          return mockImg as any;
        }
      };

      const drawCalls: any[] = [];
      const ctx = { drawImage: (...args: any[]) => drawCalls.push(args) } as any;

      const renderPromise = engine.renderOverlay(ctx, 100, 100);
      // Give the microtask queue a tick — decode() hasn't resolved yet, so nothing should be drawn.
      await Promise.resolve();
      expect(drawCalls.length).toBe(0);

      mockImg!.resolveDecode();
      await renderPromise;
      expect(drawCalls.length).toBe(1);
    });

    it('should skip a logo whose image fails to decode, without throwing', async () => {
      const engine = new VectorOverlayEngine();
      engine.addLogo({
        dataUrl: 'data:image/png;base64,corrupt',
        xPercent: 0,
        yPercent: 0,
        widthPercent: 10,
        heightPercent: 10
      });

      // @ts-ignore
      global.Image = class {
        constructor() {
          return new MockImage(true) as any;
        }
      };

      const drawCalls: any[] = [];
      const ctx = { drawImage: (...args: any[]) => drawCalls.push(args) } as any;

      await expect(engine.renderOverlay(ctx, 100, 100)).resolves.toBeUndefined();
      expect(drawCalls.length).toBe(0);
    });
  });
});
