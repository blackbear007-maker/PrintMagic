import { store } from './state';
import { SoundEffects } from '../core/sound-effects';
import { Toast } from './toast';
import type { CropAnchor } from '../types';

/**
 * Smart Focal Crop & Visual Alignment Controller
 * Controls pre-press safe zone focal anchoring when artwork aspect ratio differs from physical print preset
 */
export class CropController {
  private container: HTMLElement;
  private previewImgEl: HTMLImageElement;

  constructor(toolbarContainerId: string, previewImgId: string) {
    const el = document.getElementById(toolbarContainerId);
    const img = document.getElementById(previewImgId) as HTMLImageElement;
    if (!el || !img) throw new Error('CropController elements not found');

    this.container = el;
    this.previewImgEl = img;

    this.render();
    this.bindEvents();
    this.subscribeState();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="pm-crop-toolbar" id="cropToolbar" title="點擊九宮格對齊圖片主體焦點">
        <span class="pm-crop-label">焦點：</span>
        <div class="pm-align-matrix">
          <button class="pm-align-cell" data-anchor="top" title="靠上對齊（保留人物頭部/上方焦點）">↖</button>
          <button class="pm-align-cell" data-anchor="top" title="靠上對齊（保留人物頭部/上方焦點）">↑</button>
          <button class="pm-align-cell" data-anchor="top" title="靠上對齊（保留人物頭部/上方焦點）">↗</button>
          <button class="pm-align-cell" data-anchor="left" title="靠左對齊">←</button>
          <button class="pm-align-cell active" data-anchor="center" title="置中對齊（標準印刷居中）">·</button>
          <button class="pm-align-cell" data-anchor="right" title="靠右對齊">→</button>
          <button class="pm-align-cell" data-anchor="bottom" title="靠下對齊">↙</button>
          <button class="pm-align-cell" data-anchor="bottom" title="靠下對齊（保留底部細節）">↓</button>
          <button class="pm-align-cell" data-anchor="bottom" title="靠下對齊">↘</button>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.container.querySelectorAll<HTMLButtonElement>('.pm-align-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        const anchor = btn.dataset.anchor as CropAnchor;
        if (anchor) {
          store.setCropAnchor(anchor);
          SoundEffects.sliderTick();

          if (anchor === 'top') {
            Toast.info('📐 主體焦點：靠上對齊 (保留人物頭部)');
          } else if (anchor === 'bottom') {
            Toast.info('📐 主體焦點：靠下對齊 (保留底部基座)');
          } else if (anchor === 'left') {
            Toast.info('📐 主體焦點：靠左對齊');
          } else if (anchor === 'right') {
            Toast.info('📐 主體焦點：靠右對齊');
          } else {
            Toast.info('📐 主體焦點：置中對齊 (標準安全居中)');
          }
        }
      });
    });
  }

  private subscribeState(): void {
    store.subscribe((state) => {
      // Update button active class
      this.container.querySelectorAll<HTMLButtonElement>('.pm-align-cell').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.anchor === state.cropAnchor);
      });

      // Apply dynamic visual focal shift on preview image based on anchor
      if (state.cropAnchor === 'top') {
        this.previewImgEl.style.objectPosition = 'center top';
        this.previewImgEl.style.transformOrigin = 'center top';
        this.previewImgEl.style.transform = 'translateY(12px)';
      } else if (state.cropAnchor === 'bottom') {
        this.previewImgEl.style.objectPosition = 'center bottom';
        this.previewImgEl.style.transformOrigin = 'center bottom';
        this.previewImgEl.style.transform = 'translateY(-12px)';
      } else if (state.cropAnchor === 'left') {
        this.previewImgEl.style.objectPosition = 'left center';
        this.previewImgEl.style.transformOrigin = 'left center';
        this.previewImgEl.style.transform = 'translateX(12px)';
      } else if (state.cropAnchor === 'right') {
        this.previewImgEl.style.objectPosition = 'right center';
        this.previewImgEl.style.transformOrigin = 'right center';
        this.previewImgEl.style.transform = 'translateX(-12px)';
      } else {
        this.previewImgEl.style.objectPosition = 'center center';
        this.previewImgEl.style.transformOrigin = 'center center';
        this.previewImgEl.style.transform = 'translate(0, 0)';
      }
    });
  }
}
