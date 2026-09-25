/**
 * A tiny software canvas that really writes pixels (translate, ±1 scale, save/restore, drawImage,
 * put/getImageData). tests/setup.ts's global canvas mock draws nothing and returns zeros, which is how
 * the bleed-expander test once passed while the right/bottom bleed was fully transparent.
 * Install with: vi.stubGlobal('document', { createElement: () => new SoftCanvas() })
 */
type Matrix = { a: number; d: number; e: number; f: number };

export class SoftCanvas {
  width = 0;
  height = 0;
  buf: Uint8ClampedArray | null = null;
  getContext() {
    this.buf ??= new Uint8ClampedArray(this.width * this.height * 4);
    return new SoftContext(this);
  }
  toDataURL() {
    return 'data:image/png;base64,soft';
  }
}

export class SoftContext {
  private m: Matrix = { a: 1, d: 1, e: 0, f: 0 };
  private stack: Matrix[] = [];
  constructor(private c: SoftCanvas) {}
  save() { this.stack.push({ ...this.m }); }
  restore() { this.m = this.stack.pop() ?? { a: 1, d: 1, e: 0, f: 0 }; }
  translate(x: number, y: number) { this.m.e += this.m.a * x; this.m.f += this.m.d * y; }
  scale(x: number, y: number) { this.m.a *= x; this.m.d *= y; }
  putImageData(img: ImageData, x: number, y: number) {
    for (let row = 0; row < img.height; row++) {
      const dst = ((y + row) * this.c.width + x) * 4;
      this.c.buf!.set(img.data.subarray(row * img.width * 4, (row + 1) * img.width * 4), dst);
    }
  }
  createImageData(w: number, h: number) {
    return new ImageData(w, h);
  }
  getImageData(x: number, y: number, w: number, h: number) {
    const out = new ImageData(w, h);
    for (let row = 0; row < h; row++) {
      const src = ((y + row) * this.c.width + x) * 4;
      out.data.set(this.c.buf!.subarray(src, src + w * 4), row * w * 4);
    }
    return out;
  }
  drawImage(src: SoftCanvas, ...args: number[]) {
    const [sx, sy, sw, sh, dx, dy, dw, dh] =
      args.length === 2 ? [0, 0, src.width, src.height, args[0], args[1], src.width, src.height] : args;
    const { a, d, e, f } = this.m;
    const xs = [a * dx + e, a * (dx + dw) + e];
    const ys = [d * dy + f, d * (dy + dh) + f];
    for (let Y = Math.max(0, Math.min(...ys)); Y < Math.min(this.c.height, Math.max(...ys)); Y++) {
      const v = (Y + 0.5 - f) / d;
      if (v < dy || v >= dy + dh) continue;
      const srcY = sy + Math.floor(((v - dy) * sh) / dh);
      for (let X = Math.max(0, Math.min(...xs)); X < Math.min(this.c.width, Math.max(...xs)); X++) {
        const u = (X + 0.5 - e) / a;
        if (u < dx || u >= dx + dw) continue;
        const srcX = sx + Math.floor(((u - dx) * sw) / dw);
        const si = (srcY * src.width + srcX) * 4;
        this.c.buf!.set(src.buf!.subarray(si, si + 4), (Y * this.c.width + X) * 4);
      }
    }
  }
}
