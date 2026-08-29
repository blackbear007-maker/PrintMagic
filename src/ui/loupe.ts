import { HalftoneEngine } from '../core/halftone-engine';

/**
 * 20x Pre-Press Rosette Halftone Magnifier Loupe
 */
export class LoupeController {
  private container: HTMLElement;
  private loupeEl: HTMLElement;
  private loupeCanvas: HTMLCanvasElement;
  private loupeCtx: CanvasRenderingContext2D;
  private activeImageData: ImageData | null = null;
  private isEnabled = false;
  private zoom = 10;
  private loupeSize = 170; // diameter px

  constructor(targetContainerId: string) {
    const target = document.getElementById(targetContainerId);
    if (!target) throw new Error('Target container for Loupe not found');
    this.container = target;

    // Create Loupe Element
    // ⚠️ 2026-08-29 修正：這裡原本用的 class 名稱（pm-loupe-lens/pm-loupe-bezel/
    // pm-loupe-reticle/pm-loupe-badge）在 components.css 裡完全沒有對應的樣式規則
    // （實際定義的是 .pm-loupe/.pm-loupe-canvas/.pm-loupe-label），導致這個放大鏡
    // 完全沒有樣式——不是圓形、沒有邊框陰影、也沒有固定定位，只是一個跟著文件流跑版的
    // 未樣式化 DOM 區塊。改用實際存在的 class 名稱接上既有樣式。同時把徽章文字改成
    // 動態顯示 `${this.zoom}x`，而不是寫死「20x」（實際放大倍率是下面的 zoom=10）。
    this.loupeEl = document.createElement('div');
    this.loupeEl.className = 'pm-loupe';
    this.loupeEl.style.display = 'none';

    this.loupeCanvas = document.createElement('canvas');
    this.loupeCanvas.className = 'pm-loupe-canvas';
    this.loupeCanvas.width = this.loupeSize;
    this.loupeCanvas.height = this.loupeSize;
    this.loupeCtx = this.loupeCanvas.getContext('2d')!;

    this.loupeEl.innerHTML = `
      <div class="pm-loupe-label">${this.zoom}x CMYK 網點</div>
    `;
    this.loupeEl.insertBefore(this.loupeCanvas, this.loupeEl.firstChild);
    document.body.appendChild(this.loupeEl);

    this.bindEvents();
  }

  public setImageData(imgData: ImageData | null): void {
    this.activeImageData = imgData;
  }

  public toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    if (!this.isEnabled) {
      this.hide();
    }
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!this.isEnabled) {
      this.hide();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  private rafId: number | null = null;

  private hide(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.loupeEl.style.display = 'none';
  }

  private bindEvents(): void {
    const stage = this.container;

    stage.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isEnabled || !this.activeImageData) {
        this.hide();
        return;
      }

      const imgEl = stage.querySelector('#mainPreviewImg') as HTMLImageElement;
      if (!imgEl) return;

      const rect = imgEl.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        this.hide();
        return;
      }

      const clientX = e.clientX;
      const clientY = e.clientY;

      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
      }

      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (!this.isEnabled || !this.activeImageData) return;

        // Map client coords to source image pixel coords
        const scaleX = this.activeImageData.width / rect.width;
        const scaleY = this.activeImageData.height / rect.height;

        const srcX = (clientX - rect.left) * scaleX;
        const srcY = (clientY - rect.top) * scaleY;

        // Position Loupe centered around cursor
        this.loupeEl.style.display = 'block';
        this.loupeEl.style.left = `${clientX}px`;
        this.loupeEl.style.top = `${clientY}px`;

        // Render Rosette Halftone in Loupe Canvas
        HalftoneEngine.renderHalftonePatch(
          this.activeImageData,
          this.loupeCtx,
          { x: srcX, y: srcY },
          { width: this.loupeSize, height: this.loupeSize },
          this.zoom,
          7
        );
      });
    });

    stage.addEventListener('mouseleave', () => {
      this.hide();
    });
  }
}
