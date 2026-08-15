import { MOCKUP_SCENES, MockupRenderer, type MockupSceneId } from '../engines/mockup-renderer';
import { SoundEffects } from '../core/sound-effects';
import { Toast } from './toast';

/**
 * Gallery & Physical Studio Mockup Modal
 */
export class MockupModal {
  private modalEl: HTMLElement;
  private currentSceneId: MockupSceneId = 'gallery';
  private currentArtImg: HTMLImageElement | null = null;
  private previewImgEl!: HTMLImageElement;
  private currentMockupDataUrl: string | null = null;

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.render();
    document.body.appendChild(this.modalEl);

    this.bindEvents();
  }

  private render(): void {
    const sceneButtons = MOCKUP_SCENES.map(
      (s) => `
      <button class="pm-mockup-scene-btn ${s.id === this.currentSceneId ? 'active' : ''}" data-scene="${s.id}">
        <span>${s.icon}</span> ${s.name}
      </button>
    `
    ).join('');

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-mockup-dialog">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">🖼️ 美術館實體情境 Mockup</span>
            <span class="pm-modal-subtitle">一鍵生成真實畫廊、工作室書桌與手持名片宣傳大圖</span>
          </div>
          <button class="pm-modal-close" id="btnMockupClose">✕</button>
        </div>

        <div class="pm-mockup-scene-tabs">
          ${sceneButtons}
        </div>

        <div class="pm-mockup-preview-stage">
          <div class="pm-mockup-loader" id="mockupLoader" style="display:none;">
            <div class="pm-spinner"></div>
          </div>
          <img id="mockupPreviewImg" class="pm-mockup-img" src="" alt="情境預覽" />
        </div>

        <div class="pm-modal-footer">
          <button class="pm-btn pm-btn-ghost" id="btnMockupCancel">關閉</button>
          <button class="pm-btn pm-btn-primary" id="btnMockupDownload">
            <span>📷</span> 下載高解析宣傳圖 (1920×1280)
          </button>
        </div>
      </div>
    `;

    this.previewImgEl = this.modalEl.querySelector('#mockupPreviewImg')!;
  }

  private bindEvents(): void {
    // Close buttons
    this.modalEl.querySelector('#btnMockupClose')?.addEventListener('click', () => this.hide());
    this.modalEl.querySelector('#btnMockupCancel')?.addEventListener('click', () => this.hide());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.hide();
    });

    // Scene Buttons
    this.modalEl.querySelectorAll<HTMLButtonElement>('.pm-mockup-scene-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sceneId = btn.dataset.scene as MockupSceneId;
        if (sceneId) {
          this.currentSceneId = sceneId;
          this.modalEl.querySelectorAll('.pm-mockup-scene-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderCurrentScene();
        }
      });
    });

    // Download Button
    this.modalEl.querySelector('#btnMockupDownload')?.addEventListener('click', () => {
      if (!this.currentMockupDataUrl) return;

      SoundEffects.shutterClick();
      const link = document.createElement('a');
      link.download = `PrintMagic_Mockup_${this.currentSceneId}_${Date.now()}.png`;
      link.href = this.currentMockupDataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      Toast.success('✓ 情境宣傳大圖已下載！');
    });
  }

  public async open(artImg: HTMLImageElement): Promise<void> {
    this.currentArtImg = artImg;
    this.modalEl.style.display = 'flex';
    requestAnimationFrame(() => this.modalEl.classList.add('pm-modal-open'));
    await this.renderCurrentScene();
  }

  public hide(): void {
    this.modalEl.classList.remove('pm-modal-open');
    setTimeout(() => {
      this.modalEl.style.display = 'none';
    }, 250);
  }

  private async renderCurrentScene(): Promise<void> {
    if (!this.currentArtImg) return;

    const loader = this.modalEl.querySelector('#mockupLoader') as HTMLElement;
    if (loader) loader.style.display = 'flex';

    try {
      const dataUrl = await MockupRenderer.renderScene(this.currentArtImg, this.currentSceneId);
      this.currentMockupDataUrl = dataUrl;
      this.previewImgEl.src = dataUrl;
    } catch (err: any) {
      Toast.error('情境生成失敗: ' + err?.message);
    } finally {
      if (loader) loader.style.display = 'none';
    }
  }
}
