/**
 * 60fps Ultra-smooth Split-View Comparison Slider
 */
export class CompareSlider {
  private container: HTMLElement;
  private beforeImg: HTMLImageElement;
  private afterImg: HTMLImageElement;
  private divider: HTMLElement;
  private isDragging = false;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Compare container #${containerId} not found`);
    this.container = el;

    this.render();
    this.beforeImg = this.container.querySelector('.pm-compare-before-img')!;
    this.afterImg = this.container.querySelector('.pm-compare-after-img')!;
    this.divider = this.container.querySelector('.pm-compare-divider')!;

    this.bindEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="pm-compare-wrapper">
        <div class="pm-compare-layer pm-compare-after-layer">
          <img class="pm-compare-after-img" src="" alt="優化後" />
          <span class="pm-compare-tag pm-compare-tag-after">✨ 印刷優化 (300 DPI / TAC 控制 / 銳化)</span>
        </div>
        <div class="pm-compare-layer pm-compare-before-layer">
          <img class="pm-compare-before-img" src="" alt="原始圖" />
          <span class="pm-compare-tag pm-compare-tag-before">📷 原始原圖</span>
        </div>
        <div class="pm-compare-divider">
          <div class="pm-compare-handle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
            </svg>
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
      this.updatePositionFromEvent(e, wrapper);
    };

    const stopDrag = () => {
      this.isDragging = false;
      wrapper.classList.remove('pm-compare-active');
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
    }
  }
}
