import { store } from './state';
import { SoundEffects } from '../core/sound-effects';

/**
 * 🤌 Canvas Touch & Interaction Controller
 * Capabilities:
 * 1. 2-Finger Pinch-to-Zoom (1x to 4x) & Pan
 * 2. Double-Tap / Double-Click to Reset Zoom
 * 3. Long-Press / Hold to Quick-Peek Original Image (Apple Photos style)
 * 4. Micro-Haptics on interactions
 */
export class CanvasZoomController {
  private stage: HTMLElement;
  private sheet: HTMLElement;
  private previewImg: HTMLImageElement;
  private peekBadge: HTMLElement | null = null;
  private zoomResetBtn: HTMLButtonElement | null = null;

  // Zoom / Pan state
  private scale = 1;
  private posX = 0;
  private posY = 0;
  private minScale = 1;
  private maxScale = 4;

  // Touch tracking
  private activePointers = new Map<number, { x: number; y: number }>();
  private initialPinchDist = 0;
  private initialScale = 1;
  private isPanning = false;
  private startPanX = 0;
  private startPanY = 0;

  // Long-press tracking
  private pressTimer: any = null;
  private isPeekingOriginal = false;
  private pressStartX = 0;
  private pressStartY = 0;
  private lastTapTime = 0;

  constructor(stageId: string, sheetId: string, previewImgId: string) {
    const stage = document.getElementById(stageId);
    const sheet = document.getElementById(sheetId);
    const img = document.getElementById(previewImgId) as HTMLImageElement;

    if (!stage || !sheet || !img) {
      throw new Error('CanvasZoomController elements not found');
    }

    this.stage = stage;
    this.sheet = sheet;
    this.previewImg = img;

    this.createUIElements();
    this.bindEvents();
  }

  private createUIElements(): void {
    // 1. Long-press peek original indicator badge
    this.peekBadge = document.createElement('div');
    this.peekBadge.className = 'pm-canvas-peek-badge';
    this.peekBadge.innerHTML = '<span>👁️ 查看原圖中 (放開還原)</span>';
    this.peekBadge.style.display = 'none';
    this.stage.appendChild(this.peekBadge);

    // 2. Zoom reset badge button (appears when scale > 1.05)
    this.zoomResetBtn = document.createElement('button');
    this.zoomResetBtn.className = 'pm-canvas-zoom-reset-btn';
    this.zoomResetBtn.type = 'button';
    this.zoomResetBtn.innerHTML = '<span>🔍 100% 還原</span>';
    this.zoomResetBtn.style.display = 'none';
    this.zoomResetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetZoom(true);
    });
    this.stage.appendChild(this.zoomResetBtn);
  }

  private bindEvents(): void {
    this.stage.style.touchAction = 'none'; // allow pointer tracking

    // Pointer events for pinch, pan, and long-press
    this.stage.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.stage.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.stage.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.stage.addEventListener('pointercancel', this.onPointerUp.bind(this));

    // Mouse wheel zoom
    this.stage.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || this.scale > 1) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        this.applyZoom(this.scale + delta);
      }
    }, { passive: false });
  }

  private onPointerDown(e: PointerEvent): void {
    this.stage.setPointerCapture(e.pointerId);
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Double-tap reset check
    const now = Date.now();
    if (this.activePointers.size === 1 && now - this.lastTapTime < 320) {
      this.clearPressTimer();
      if (this.scale > 1.05) {
        this.resetZoom(true);
      } else {
        this.applyZoom(2.2);
      }
      this.lastTapTime = 0;
      return;
    }
    this.lastTapTime = now;

    if (this.activePointers.size === 1) {
      // Single pointer: prepare long-press peek or pan
      this.pressStartX = e.clientX;
      this.pressStartY = e.clientY;
      this.startPanX = e.clientX - this.posX;
      this.startPanY = e.clientY - this.posY;

      // Start long-press timer for Original Peek (240ms)
      if (this.scale <= 1.05) {
        this.pressTimer = setTimeout(() => {
          this.startPeekingOriginal();
        }, 240);
      } else {
        this.isPanning = true;
      }
    } else if (this.activePointers.size === 2) {
      // Two pointers: prepare pinch-to-zoom
      this.clearPressTimer();
      this.endPeekingOriginal();
      const points = Array.from(this.activePointers.values());
      this.initialPinchDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      this.initialScale = this.scale;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // If pointer moved more than 8px, cancel long-press peek timer
    if (this.pressTimer) {
      const dist = Math.hypot(e.clientX - this.pressStartX, e.clientY - this.pressStartY);
      if (dist > 8) {
        this.clearPressTimer();
      }
    }

    if (this.activePointers.size === 2 && this.initialPinchDist > 0) {
      // 2-Finger Pinch Zooming
      const points = Array.from(this.activePointers.values());
      const currentDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const ratio = currentDist / this.initialPinchDist;
      this.applyZoom(this.initialScale * ratio);
    } else if (this.activePointers.size === 1 && this.scale > 1.05 && this.isPanning) {
      // 1-Finger Panning while zoomed in
      this.posX = e.clientX - this.startPanX;
      this.posY = e.clientY - this.startPanY;
      this.updateTransform();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);
    this.clearPressTimer();
    this.isPanning = false;

    if (this.isPeekingOriginal) {
      this.endPeekingOriginal();
    }

    if (this.activePointers.size < 2) {
      this.initialPinchDist = 0;
    }
  }

  private clearPressTimer(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  /**
   * Start Long-Press Quick Peek of pristine original image
   */
  private startPeekingOriginal(): void {
    const state = store.getState();
    if (!state.originalDataUrl || !state.processedDataUrl) return;

    this.isPeekingOriginal = true;
    this.previewImg.src = state.originalDataUrl;

    if (this.peekBadge) {
      this.peekBadge.style.display = 'inline-flex';
    }

    // Trigger subtle haptic pulse
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(18);
    }
    SoundEffects.sliderTick();
  }

  /**
   * End Long-Press Quick Peek and restore 300 DPI super-resolution image
   */
  private endPeekingOriginal(): void {
    if (!this.isPeekingOriginal) return;
    this.isPeekingOriginal = false;

    const state = store.getState();
    if (state.processedDataUrl) {
      this.previewImg.src = state.processedDataUrl;
    }

    if (this.peekBadge) {
      this.peekBadge.style.display = 'none';
    }
  }

  /**
   * Apply scale factor with bounds check
   */
  private applyZoom(targetScale: number): void {
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, targetScale));
    if (this.scale <= 1.05) {
      this.scale = 1;
      this.posX = 0;
      this.posY = 0;
    }
    this.updateTransform();
  }

  /**
   * Reset Zoom to 100% with spring transition
   */
  public resetZoom(animate = true): void {
    if (animate) {
      this.sheet.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
      setTimeout(() => {
        this.sheet.style.transition = '';
      }, 250);
    }
    this.scale = 1;
    this.posX = 0;
    this.posY = 0;
    this.updateTransform();
    SoundEffects.sliderTick();
  }

  private updateTransform(): void {
    if (this.scale > 1) {
      this.sheet.style.transform = `translate3d(${this.posX}px, ${this.posY}px, 0) scale(${this.scale})`;
    } else {
      this.sheet.style.transform = '';
    }

    if (this.zoomResetBtn) {
      this.zoomResetBtn.style.display = this.scale > 1.05 ? 'inline-flex' : 'none';
      if (this.scale > 1.05) {
        this.zoomResetBtn.innerHTML = `<span>🔍 ${(this.scale * 100).toFixed(0)}% (點擊重設)</span>`;
      }
    }
  }
}
