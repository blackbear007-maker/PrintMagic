import { store } from './state';
import { SoundEffects } from '../core/sound-effects';
import { Toast } from './toast';
import type { CropAnchor } from '../types';
import { SmartCropClient } from '../services/smart-crop-client';

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
        <button class="pm-btn pm-btn-xs pm-btn-secondary" id="btnSmartCropSuggest" title="用 smartcrop.js 分析構圖，自動建議最佳焦點方向">✨ AI 建議</button>
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

    this.container.querySelector<HTMLButtonElement>('#btnSmartCropSuggest')?.addEventListener('click', async () => {
      await this.suggestCropAnchor();
    });
  }

  /**
   * Runs smartcrop.js (best-effort face-boosted via YuNet, see SmartCropClient's own note)
   * against the current image and the current print preset's aspect ratio, then maps its
   * pixel-precise crop rect onto the nearest of this app's 5 discrete anchor positions —
   * this UI only ever supported top/bottom/left/right/center, not an arbitrary crop rect, so a
   * lossy mapping is the honest choice here rather than silently ignoring smartcrop's precision.
   */
  private async suggestCropAnchor(): Promise<void> {
    const state = store.getState();
    const imgData = state.processedImageData || state.originalImageData;
    if (!imgData) {
      Toast.error('請先上傳圖片');
      return;
    }

    const preset = state.currentPreset;
    const presetRatio = preset.widthMm / preset.heightMm;
    let targetWidth = imgData.width;
    let targetHeight = Math.round(targetWidth / presetRatio);
    if (targetHeight > imgData.height) {
      targetHeight = imgData.height;
      targetWidth = Math.round(targetHeight * presetRatio);
    }

    Toast.info('✨ 正在分析構圖...');
    try {
      const result = await SmartCropClient.suggestCrop(imgData, targetWidth, targetHeight);
      const cropCenterX = result.crop.x + result.crop.width / 2;
      const cropCenterY = result.crop.y + result.crop.height / 2;
      const imgCenterX = imgData.width / 2;
      const imgCenterY = imgData.height / 2;
      const dx = cropCenterX - imgCenterX;
      const dy = cropCenterY - imgCenterY;
      const threshold = Math.min(imgData.width, imgData.height) * 0.08;

      let anchor: CropAnchor = 'center';
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        anchor = dx > 0 ? 'right' : 'left';
      } else if (Math.abs(dy) > threshold) {
        anchor = dy > 0 ? 'bottom' : 'top';
      }

      store.setCropAnchor(anchor);
      SoundEffects.sliderTick();
      Toast.success(`✓ ${result.engine} 建議焦點：${this.anchorLabel(anchor)}`);
    } catch (err: any) {
      Toast.error(`構圖分析失敗：${err?.message || '未知錯誤'}`);
    }
  }

  private anchorLabel(anchor: CropAnchor): string {
    const labels: Record<CropAnchor, string> = {
      top: '靠上',
      bottom: '靠下',
      left: '靠左',
      right: '靠右',
      center: '置中'
    };
    return labels[anchor];
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
