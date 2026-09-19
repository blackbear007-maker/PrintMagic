import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { NetworkGuard } from '../services/network-guard';

/**
 * ⚙️ 引擎設定面板
 *
 * 2026-09-19 簡化：使用者只需要決定「要不要用雲端」，不需要知道背後是哪些自建服務/模型/授權
 * 條款——面板從一份完整技術清單（VTracer/Real-ESRGAN/LaMa/rembg/YuNet/ICC 等）簡化成單一
 * 100% 本機模式開關。完整的技術誠實揭露歷史（哪些模型真的有跑、驗證過程、移除過的模型與原因）
 * 保留在 docs/SPEC.md，不在使用者介面重複呈現。
 */
export class AiSettingsModal {
  private modalEl: HTMLElement;
  private onModelChanged?: () => void;

  constructor(onModelChanged?: () => void) {
    this.onModelChanged = onModelChanged;
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'aiSettingsModal';
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.render();
    document.body.appendChild(this.modalEl);
    this.bindEvents();
  }

  public render(): void {
    const isPrivacyShieldActive = NetworkGuard.isPrivacyShieldActive();

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 480px; width: 94vw;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="icons/header/mode-advanced.webp" alt="" class="pm-icon-img" />
            <div>
              <h3 class="pm-modal-title">引擎設定</h3>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseAiSettings"><img src="icons/shared/close.webp" alt="" class="pm-icon-img" /></button>
        </div>

        <div class="pm-modal-body" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;">
          <!-- Privacy Shield -->
          <div style="background: ${isPrivacyShieldActive ? 'linear-gradient(135deg, rgba(88,86,214,0.12) 0%, rgba(60,30,140,0.08) 100%)' : 'rgba(0,0,0,0.02)'}; border: 1.5px solid ${isPrivacyShieldActive ? 'var(--pm-accent-purple, #4b2aa8)' : 'var(--pm-border-subtle)'}; border-radius: 12px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="icons/shared/lock.webp" alt="" class="pm-icon-img" />
              <div>
                <div style="font-size: 0.86rem; font-weight: 700; color: var(--pm-text-primary);">100% 本機模式</div>
                <div style="font-size: 0.72rem; color: var(--pm-text-muted); margin-top: 1px; max-width: 300px;">
                  ${isPrivacyShieldActive
                    ? '已開啟：圖片絕不離開你的裝置。'
                    : '關閉時會優先嘗試雲端以取得更好結果，離線時自動退回本機處理。'}
                </div>
              </div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; margin-left: 12px; cursor: pointer; flex-shrink: 0;">
              <input type="checkbox" id="togglePrivacyShield" ${isPrivacyShieldActive ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;" />
              <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isPrivacyShieldActive ? '#34c759' : '#ccc'}; border-radius: 24px; transition: .3s;"></span>
              <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${isPrivacyShieldActive ? '23px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .3s;"></span>
            </label>
          </div>
        </div>

        <div class="pm-modal-footer">
          <button class="pm-btn pm-btn-ghost" id="btnCancelAiSettings">取消</button>
          <button class="pm-btn pm-btn-primary" id="btnSaveAiSettings">儲存設定</button>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const close = () => this.close();
    this.modalEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.id === 'togglePrivacyShield') {
        const checkbox = target as HTMLInputElement;
        NetworkGuard.setPrivacyShield(checkbox.checked);
        SoundEffects.sliderTick();
        Toast.info(checkbox.checked ? '🔒 已開啟 100% 本機模式' : '🌐 已恢復自建服務優先，離線自動退回本機');
        this.render();
        return;
      }

      if (target.id === 'btnCloseAiSettings' || target.id === 'btnCancelAiSettings' || target.id === 'aiSettingsModal') {
        close();
      }

      if (target.id === 'btnSaveAiSettings') {
        SoundEffects.purityChime();
        Toast.success('✓ 設定已儲存！');
        this.close();
        if (this.onModelChanged) this.onModelChanged();
      }
    });
  }

  public open(): void {
    this.render();
    this.modalEl.style.display = 'flex';
    this.modalEl.classList.add('pm-modal-open');
    SoundEffects.sliderTick();
  }

  public close(): void {
    this.modalEl.style.display = 'none';
    this.modalEl.classList.remove('pm-modal-open');
  }
}
