import { SoundEffects } from '../core/sound-effects';

/**
 * 60fps Ultra-smooth Split-View Comparison Slider
 * Precision visual diffing with non-clipped badges and clear left/right indicators
 */
export class CompareSlider {
  private container: HTMLElement;
  private beforeImg: HTMLImageElement;
  private afterImg: HTMLImageElement;
  private divider: HTMLElement;
  private beforeTag: HTMLElement;
  private afterTag: HTMLElement;
  private isDragging = false;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Compare container #${containerId} not found`);
    this.container = el;

    this.render();
    this.beforeImg = this.container.querySelector('.pm-compare-before-img')!;
    this.afterImg = this.container.querySelector('.pm-compare-after-img')!;
    this.divider = this.container.querySelector('.pm-compare-divider')!;
    this.beforeTag = this.container.querySelector('.pm-compare-tag-before')!;
    this.afterTag = this.container.querySelector('.pm-compare-tag-after')!;

    this.bindEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="pm-compare-container">
        <!-- Top Instruction Breadcrumb Hint -->
        <div class="pm-compare-header-hint">
          <span class="pm-compare-pill-badge pm-pill-before">◂ 原始原圖 (左側)</span>
          <span class="pm-compare-hint-text">拖曳中間白色滑桿，即時比對畫質差異</span>
          <span class="pm-compare-pill-badge pm-pill-after">印刷準備優化 (右側) ▸</span>
        </div>

        <div class="pm-compare-wrapper">
          <!-- Base Layer: Processed (Right Side) -->
          <div class="pm-compare-layer pm-compare-after-layer">
            <img class="pm-compare-after-img" src="" alt="印刷準備優化" />
          </div>

          <!-- Overlay Layer: Original (Left Side, Clipped) -->
          <div class="pm-compare-layer pm-compare-before-layer">
            <img class="pm-compare-before-img" src="" alt="原始圖檔" />
          </div>

          <!-- High-Contrast Floating Badges (Fixed directly on Artwork, Never Clipped) -->
          <div class="pm-compare-overlay-tags">
            <div class="pm-compare-tag pm-compare-tag-before" title="左側畫面：原始上傳圖檔 (未超解析/未控墨)">
              <span class="pm-tag-dot pm-dot-before"></span>
              <span class="pm-tag-title">📷 原始原圖</span>
              <span class="pm-tag-desc">低解析 / 未校色</span>
            </div>
            <div class="pm-compare-tag pm-compare-tag-after" title="右側畫面：8x Lanczos-3 超解析 + USM 銳化 + TAC 300% 控墨">
              <span class="pm-tag-dot pm-dot-after"></span>
              <span class="pm-tag-title">✨ 印刷準備優化</span>
              <span class="pm-tag-desc">300 DPI / TAC 墨量防護</span>
            </div>
          </div>

          <!-- Central Drag Divider -->
          <div class="pm-compare-divider">
            <div class="pm-compare-handle" title="左右拖動滑桿比對">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
              </svg>
              <div class="pm-compare-handle-label">
                <span>◂ 原圖</span>
                <span class="pm-handle-sep">|</span>
                <span>優化 ▸</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  public setImages(beforeSrc: string, afterSrc: string): void {
    this.beforeImg.src = beforeSrc;
    this.afterImg.src = afterSrc;
    this.setPosition(50);
  }

  private bindEvents(): void {
    const wrapper = this.container.querySelector('.pm-compare-wrapper') as HTMLElement;
    if (!wrapper) return;

    const startDrag = (e: MouseEvent | TouchEvent) => {
      this.isDragging = true;
      wrapper.classList.add('pm-compare-active');
      SoundEffects.sliderTick();
      this.updatePositionFromEvent(e, wrapper);
    };

    const stopDrag = () => {
      if (this.isDragging) {
        this.isDragging = false;
        wrapper.classList.remove('pm-compare-active');
      }
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      this.updatePositionFromEvent(e, wrapper);
    };

    // Mouse Events
    wrapper.addEventListener('mousedown', startDrag);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('mousemove', onMove);

    // Touch Events
    wrapper.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('touchend', stopDrag);
    window.addEventListener('touchmove', onMove, { passive: true });
  }

  private updatePositionFromEvent(e: MouseEvent | TouchEvent, wrapper: HTMLElement): void {
    const rect = wrapper.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const offsetX = clientX - rect.left;
    let percent = (offsetX / rect.width) * 100;
    percent = Math.max(0, Math.min(100, percent));
    this.setPosition(percent);
  }

  public setPosition(percent: number): void {
    const beforeLayer = this.container.querySelector('.pm-compare-before-layer') as HTMLElement;
    if (beforeLayer && this.divider) {
      beforeLayer.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
      this.divider.style.left = `${percent}%`;

      // Smart badge opacity based on divider overlap
      if (this.beforeTag && this.afterTag) {
        this.beforeTag.style.opacity = percent < 15 ? '0.25' : '1';
        this.afterTag.style.opacity = percent > 85 ? '0.25' : '1';
      }
    }
  }
}
