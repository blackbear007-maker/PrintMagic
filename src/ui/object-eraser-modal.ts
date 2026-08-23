import { ObjectEraser } from '../core/object-eraser';
import { FreeInpaintingClient } from '../services/free-inpainting-client';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';

/**
 * 🪄 AI 智慧消除筆 / 物件移除互動視窗 (Object Eraser Modal)
 * Apple HIG 極簡雙層 Canvas 塗抹介面，支援行動觸控與前後對比
 */
export class ObjectEraserModal {
  private overlay: HTMLElement;
  private onApply?: (newImageData: ImageData, newDataUrl: string) => void;

  private currentSrcImageData: ImageData | null = null;
  private currentResultImageData: ImageData | null = null;
  private brushSize: number = 32;
  private isDrawing: boolean = false;
  private isEraserMode: boolean = false;
  private isComparing: boolean = false;

  private imgCanvas: HTMLCanvasElement | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private cursorPreview: HTMLElement | null = null;

  constructor(onApply?: (newImageData: ImageData, newDataUrl: string) => void) {
    this.onApply = onApply;
    this.overlay = document.createElement('div');
    this.overlay.className = 'pm-modal-overlay pm-object-eraser-overlay';
    this.overlay.style.display = 'none';
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
  }

  public open(srcImageData: ImageData): void {
    this.currentSrcImageData = srcImageData;
    this.currentResultImageData = null;
    this.isComparing = false;
    SoundEffects.sliderTick();
    this.render();
    this.overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this.initCanvasAndEvents();
  }

  public close(): void {
    SoundEffects.sliderTick();
    this.overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  private render(): void {
    this.overlay.innerHTML = `
      <div class="pm-modal pm-modal-lg pm-eraser-modal" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="pm-modal-icon-badge" style="background: rgba(255, 45, 85, 0.1); color: #ff2d55; font-size: 1.4rem;">🪄</div>
            <div>
              <h2 class="pm-modal-title">AI 智慧消除筆 / 物件移除</h2>
              <p class="pm-modal-desc">
                以手指或滑鼠塗抹想去除的路人、雜物或瑕疵，本機 AI 自動重構背景
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseEraser" title="關閉視窗">✕</button>
        </div>

        <!-- Floating Interactive Toolbar -->
        <div class="pm-eraser-toolbar">
          <div class="pm-eraser-tool-group">
            <label class="pm-eraser-tool-label">
              <span>🖌️ 筆刷大小：</span>
              <span id="brushSizeVal" style="font-weight: 700; color: var(--pm-accent-blue); min-width: 32px;">${this.brushSize}px</span>
            </label>
            <input type="range" id="inputBrushSize" min="8" max="96" value="${this.brushSize}" class="pm-slider-range" style="width: 110px;" />
          </div>

          <div class="pm-eraser-tool-group">
            <button id="btnToggleEraserMode" class="pm-btn pm-btn-ghost pm-btn-xs" title="切換塗抹 / 擦除選區">
              <span id="eraserModeIcon">🖌️</span> <span id="eraserModeText">塗抹選區</span>
            </button>
            <button id="btnClearMask" class="pm-btn pm-btn-ghost pm-btn-xs" title="清空全部塗抹選區">
              <span>🗑️</span> 清空選區
            </button>
          </div>

          <div class="pm-eraser-tool-group" style="margin-left: auto;">
            <button id="btnRunInpaint" class="pm-btn pm-btn-primary pm-btn-sm" style="background: linear-gradient(135deg, #ff2d55, #af52de); border: none; font-weight: 700; box-shadow: 0 4px 14px rgba(255, 45, 85, 0.35);">
              <span>✨</span> 開始消除
            </button>
            <button id="btnToggleCompareResult" class="pm-btn pm-btn-secondary pm-btn-sm" style="display: none;">
              <span>👁️</span> 查看原圖
            </button>
          </div>
        </div>

        <!-- Canvas Workspace -->
        <div class="pm-eraser-workspace" id="eraserWorkspace">
          <div class="pm-eraser-canvas-wrapper" id="canvasWrapper">
            <canvas id="eraserImgCanvas"></canvas>
            <canvas id="eraserMaskCanvas"></canvas>
            <div id="eraserBrushCursor" class="pm-eraser-cursor"></div>
          </div>

          <div class="pm-eraser-loading" id="eraserLoading" style="display: none;">
            <div class="pm-spinner" style="border-top-color: #ff2d55;"></div>
            <span style="font-weight: 600; font-size: 0.9rem; color: var(--pm-text-primary); margin-top: 8px;">
              正在分析周圍紋理並進行 AI 無痕補景...
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="pm-modal-footer">
          <button class="pm-btn pm-btn-ghost" id="btnCancelEraser">取消</button>
          <button class="pm-btn pm-btn-primary" id="btnApplyEraser" disabled style="box-shadow: 0 4px 12px rgba(0, 113, 227, 0.28);">
            <span>🌟</span> 套用並更新印刷檔
          </button>
        </div>
      </div>
    `;

    // Bind modal dismiss buttons
    document.getElementById('btnCloseEraser')?.addEventListener('click', () => this.close());
    document.getElementById('btnCancelEraser')?.addEventListener('click', () => this.close());
  }

  private initCanvasAndEvents(): void {
    if (!this.currentSrcImageData) return;

    this.imgCanvas = document.getElementById('eraserImgCanvas') as HTMLCanvasElement;
    this.maskCanvas = document.getElementById('eraserMaskCanvas') as HTMLCanvasElement;
    this.cursorPreview = document.getElementById('eraserBrushCursor');
    const wrapper = document.getElementById('canvasWrapper');
    if (!this.imgCanvas || !this.maskCanvas || !wrapper) return;

    const w = this.currentSrcImageData.width;
    const h = this.currentSrcImageData.height;

    this.imgCanvas.width = w;
    this.imgCanvas.height = h;
    this.maskCanvas.width = w;
    this.maskCanvas.height = h;

    const imgCtx = this.imgCanvas.getContext('2d')!;
    imgCtx.putImageData(this.currentSrcImageData, 0, 0);

    const maskCtx = this.maskCanvas.getContext('2d')!;
    maskCtx.clearRect(0, 0, w, h);

    // Bind Brush Size Slider
    const sizeSlider = document.getElementById('inputBrushSize') as HTMLInputElement;
    const sizeVal = document.getElementById('brushSizeVal');
    sizeSlider?.addEventListener('input', () => {
      this.brushSize = parseInt(sizeSlider.value, 10);
      if (sizeVal) sizeVal.textContent = `${this.brushSize}px`;
      this.updateCursorSize();
    });

    // Toggle Eraser Mode (draw mask vs erase mask)
    const btnToggleMode = document.getElementById('btnToggleEraserMode');
    const modeIcon = document.getElementById('eraserModeIcon');
    const modeText = document.getElementById('eraserModeText');
    btnToggleMode?.addEventListener('click', () => {
      this.isEraserMode = !this.isEraserMode;
      if (modeIcon) modeIcon.textContent = this.isEraserMode ? '🧽' : '🖌️';
      if (modeText) modeText.textContent = this.isEraserMode ? '擦除選區' : '塗抹選區';
      btnToggleMode.classList.toggle('active', this.isEraserMode);
      SoundEffects.sliderTick();
    });

    // Clear Mask
    document.getElementById('btnClearMask')?.addEventListener('click', () => {
      maskCtx.clearRect(0, 0, w, h);
      SoundEffects.sliderTick();
      Toast.info('已清空塗抹選區');
    });

    // Drawing Events (Pointer Events for Touch & Mouse compatibility)
    let lastX = 0;
    let lastY = 0;

    const getCanvasCoords = (e: PointerEvent) => {
      const rect = this.maskCanvas!.getBoundingClientRect();
      const scaleX = this.maskCanvas!.width / rect.width;
      const scaleY = this.maskCanvas!.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      maskCtx.save();
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      maskCtx.lineWidth = this.brushSize;

      if (this.isEraserMode) {
        maskCtx.globalCompositeOperation = 'destination-out';
      } else {
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.strokeStyle = 'rgba(255, 45, 85, 0.65)'; // Semi-transparent Apple Neon Pink
        maskCtx.fillStyle = 'rgba(255, 45, 85, 0.65)';
      }

      maskCtx.beginPath();
      maskCtx.moveTo(x1, y1);
      maskCtx.lineTo(x2, y2);
      maskCtx.stroke();

      // Dot at end
      maskCtx.beginPath();
      maskCtx.arc(x2, y2, this.brushSize / 2, 0, Math.PI * 2);
      maskCtx.fill();
      maskCtx.restore();
    };

    const onPointerDown = (e: PointerEvent) => {
      this.isDrawing = true;
      const coords = getCanvasCoords(e);
      lastX = coords.x;
      lastY = coords.y;
      drawLine(lastX, lastY, lastX, lastY);
      this.maskCanvas?.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      // Update cursor position
      if (this.cursorPreview) {
        const rect = wrapper.getBoundingClientRect();
        this.cursorPreview.style.left = `${e.clientX - rect.left}px`;
        this.cursorPreview.style.top = `${e.clientY - rect.top}px`;
        this.cursorPreview.style.display = 'block';
      }

      if (!this.isDrawing) return;
      const coords = getCanvasCoords(e);
      drawLine(lastX, lastY, coords.x, coords.y);
      lastX = coords.x;
      lastY = coords.y;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.isDrawing) {
        this.isDrawing = false;
        try {
          this.maskCanvas?.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    this.maskCanvas.addEventListener('pointerdown', onPointerDown);
    this.maskCanvas.addEventListener('pointermove', onPointerMove);
    this.maskCanvas.addEventListener('pointerup', onPointerUp);
    this.maskCanvas.addEventListener('pointerleave', () => {
      if (this.cursorPreview) this.cursorPreview.style.display = 'none';
      this.isDrawing = false;
    });

    this.updateCursorSize();

    // Run Inpainting Button
    const btnRunInpaint = document.getElementById('btnRunInpaint');
    const loadingEl = document.getElementById('eraserLoading');
    const btnApply = document.getElementById('btnApplyEraser') as HTMLButtonElement;
    const btnCompare = document.getElementById('btnToggleCompareResult') as HTMLButtonElement;

    btnRunInpaint?.addEventListener('click', async () => {
      if (!this.currentSrcImageData || !this.maskCanvas) return;

      const maskCtx = this.maskCanvas.getContext('2d')!;
      const maskImageData = maskCtx.getImageData(0, 0, w, h);

      // Check if user painted anything
      let hasPaint = false;
      for (let i = 3; i < maskImageData.data.length; i += 4) {
        if (maskImageData.data[i] > 20) {
          hasPaint = true;
          break;
        }
      }

      if (!hasPaint) {
        Toast.warning('請先使用筆刷塗抹想要消除的區域！');
        return;
      }

      if (loadingEl) loadingEl.style.display = 'flex';
      SoundEffects.shutterClick();

      const startTime = performance.now();
      const inpaintResult = await FreeInpaintingClient.eraseObject(this.currentSrcImageData, maskImageData);
      const inpainted = inpaintResult.imageData;
      const elapsed = Math.round(performance.now() - startTime);

      this.currentResultImageData = inpainted;

      // Render result on imgCanvas
      imgCtx.putImageData(inpainted, 0, 0);
      // Clear mask canvas
      maskCtx.clearRect(0, 0, w, h);

      if (loadingEl) loadingEl.style.display = 'none';
      if (btnApply) btnApply.disabled = false;
      if (btnCompare) btnCompare.style.display = 'inline-flex';

      SoundEffects.purityChime();
      Toast.success(`✨ 物件消除完成 (${elapsed}ms · ${inpaintResult.modelUsed})！可長按「查看原圖」進行對比。`);
    });

    // Before / After Compare Toggle Button
    btnCompare?.addEventListener('click', () => {
      if (!this.currentResultImageData || !this.currentSrcImageData) return;
      this.isComparing = !this.isComparing;
      btnCompare.classList.toggle('active', this.isComparing);
      btnCompare.innerHTML = this.isComparing ? '<span>👁️</span> 顯示消除後' : '<span>👁️</span> 查看原圖';

      imgCtx.putImageData(this.isComparing ? this.currentSrcImageData : this.currentResultImageData, 0, 0);
      SoundEffects.sliderTick();
    });

    // Apply Button
    btnApply?.addEventListener('click', () => {
      if (!this.currentResultImageData) return;
      const dataUrl = ObjectEraser.imageDataToDataUrl(this.currentResultImageData);
      if (this.onApply) {
        this.onApply(this.currentResultImageData, dataUrl);
      }
      this.close();
      SoundEffects.purityChime();
      Toast.success('🪄 成功套用消除結果！已為您自動重新優化印刷製版。');
    });
  }

  private updateCursorSize(): void {
    if (!this.cursorPreview || !this.maskCanvas) return;
    const rect = this.maskCanvas.getBoundingClientRect();
    const scale = rect.width / this.maskCanvas.width;
    const displaySize = Math.max(12, this.brushSize * scale);

    this.cursorPreview.style.width = `${displaySize}px`;
    this.cursorPreview.style.height = `${displaySize}px`;
  }
}
