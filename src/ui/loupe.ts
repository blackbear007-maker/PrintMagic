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
    this.loupeEl = document.createElement('div');
    this.loupeEl.className = 'pm-loupe-lens';
    this.loupeEl.style.display = 'none';

    this.loupeCanvas = document.createElement('canvas');
    this.loupeCanvas.width = this.loupeSize;
    this.loupeCanvas.height = this.loupeSize;
    this.loupeCtx = this.loupeCanvas.getContext('2d')!;

    this.loupeEl.innerHTML = `
      <div class="pm-loupe-bezel">
        <div class="pm-loupe-reticle"></div>
        <div class="pm-loupe-badge">20x CMYK 網點</div>
      </div>
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
