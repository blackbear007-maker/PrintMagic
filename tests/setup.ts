// Global Test Setup for Vitest (Node.js Environment)

if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataPolyfill {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: PredefinedColorSpace = 'srgb';

    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, maybeHeight?: number) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = maybeHeight || 0;
      }
    }
  }

  (globalThis as any).ImageData = ImageDataPolyfill;
}

// Global Image Polyfill
if (typeof (globalThis as any).Image === 'undefined') {
  (globalThis as any).Image = class {
    public onload: any = null;
    public onerror: any = null;
    public naturalWidth = 100;
    public naturalHeight = 100;
    public width = 100;
    public height = 100;
    private _src = '';

    get src() {
      return this._src;
    }
    set src(val: string) {
      this._src = val;
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 1);
    }
  };
}

// Mock Canvas & 2D Context generator
const createMockCtx = () => ({
  createImageData: (w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
    colorSpace: 'srgb'
  }),
  putImageData: () => {},
  drawImage: () => {},
  fillRect: () => {},
  fillText: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  save: () => {},
  restore: () => {},
  scale: () => {},
  translate: () => {},
  rotate: () => {},
  getImageData: (_x: number, _y: number, w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
    colorSpace: 'srgb'
  })
});

const createMockCanvas = () => {
  const ctx = createMockCtx();
  return {
    width: 300,
    height: 300,
    getContext: (_type: string) => ctx,
    toDataURL: (_type?: string) => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  };
};

if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return createMockCanvas();
      return {};
    }
  };
} else {
  const orig = globalThis.document.createElement ? globalThis.document.createElement.bind(globalThis.document) : null;
  globalThis.document.createElement = ((tag: string, options?: any) => {
    if (tag === 'canvas') {
      try {
        const el: any = orig ? orig(tag, options) : null;
        if (!el || typeof el.getContext !== 'function' || !el.getContext('2d')?.putImageData) {
          return createMockCanvas();
        }
        return el;
      } catch {
        return createMockCanvas();
      }
    }
    return orig ? orig(tag, options) : {};
  }) as any;
}
