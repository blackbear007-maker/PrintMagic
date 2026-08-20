import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { AI_MODELS, AiUpscaleClient, type AiModelType } from '../services/ai-upscale-client';

/**
 * 🧠 AI 深度學習神經網路模型設定面板 (公測免費開源模型)
 */
export class AiSettingsModal {
  private modalEl: HTMLElement;
  private onModelChanged?: () => void;

  constructor(onModelChanged?: () => void, _onOpenPricing?: () => void) {
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
    const currentModel = AiUpscaleClient.getStoredModel();
    const currentToken = AiUpscaleClient.getStoredToken();

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 620px; width: 92vw;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.6rem;">🧠</span>
            <div>
              <h3 class="pm-modal-title">AI 超解析度神經網路模型設定</h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                公測期間免費提供開源深度學習神經網路模型與本機超解析度引擎
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseAiSettings">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 20px 24px; max-height: 75vh; overflow-y: auto;">
          <div style="background: rgba(0, 0, 0, 0.02); border: 1.5px solid var(--pm-border-subtle); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="font-size: 0.9rem; font-weight: 700; color: var(--pm-text-primary); display: flex; align-items: center; gap: 6px;">
                <span>🌐</span> 開源高精度 AI 重建模型
              </label>
              <span style="font-size: 0.72rem; color: var(--pm-status-success); font-weight: 700; background: rgba(52, 199, 89, 0.12); padding: 3px 9px; border-radius: 12px;">✓ 公測免費開放</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${AI_MODELS.map(
                (m) => `
                <label style="display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; background: #ffffff; border: 1.5px solid ${currentModel === m.id ? 'var(--pm-accent-blue)' : 'var(--pm-border-subtle)'}; border-radius: var(--pm-radius-sm); cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);">
                  <input type="radio" name="aiModelChoice" value="std:${m.id}" ${currentModel === m.id ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--pm-accent-blue);" />
                  <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-weight: 700; font-size: 0.88rem; color: var(--pm-text-primary);">${m.name}</span>
                      <span style="font-size: 0.7rem; color: #0071e3; font-weight: 600; background: rgba(0, 113, 227, 0.08); padding: 2px 6px; border-radius: 4px;">4x 放大</span>
                    </div>
                    <div style="font-size: 0.76rem; color: var(--pm-text-muted); margin-top: 3px; line-height: 1.35;">${m.desc}</div>
                  </div>
                </label>
              `
              ).join('')}
            </div>

            <!-- Hugging Face Token Configuration -->
            <div style="margin-top: 4px; padding-top: 14px; border-top: 1px solid var(--pm-border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 0.8rem; font-weight: 600; color: var(--pm-text-secondary);">
                  自訂 Hugging Face Token (選填)
                </label>
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" style="font-size: 0.72rem; color: var(--pm-accent-blue); font-weight: 600; text-decoration: none;">
                  🔑 免費領取 Token ➔
                </a>
              </div>
              <input
                type="password"
                id="inputHfToken"
                value="${currentToken}"
                placeholder="hf_xxxxxxxxxxxxxxxxxxxx (留空使用公共共享通道)"
                style="width: 100%; padding: 8px 12px; font-family: monospace; font-size: 0.78rem; background: #ffffff; border: 1px solid var(--pm-border-subtle); border-radius: var(--pm-radius-sm); color: var(--pm-text-primary); box-sizing: border-box;"
              />
            </div>
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
      if (target.id === 'btnCloseAiSettings' || target.id === 'btnCancelAiSettings' || target.id === 'aiSettingsModal') {
        close();
      }

      if (target.id === 'btnSaveAiSettings') {
        const selectedRadio = this.modalEl.querySelector<HTMLInputElement>('input[name="aiModelChoice"]:checked');
        if (selectedRadio) {
          const val = selectedRadio.value;
          if (val.startsWith('std:')) {
            const stdId = val.replace('std:', '') as AiModelType;
            AiUpscaleClient.setStoredModel(stdId);
          }
        }

        const inputToken = this.modalEl.querySelector<HTMLInputElement>('#inputHfToken');
        if (inputToken) {
          AiUpscaleClient.setStoredToken(inputToken.value);
        }

        SoundEffects.purityChime();
        Toast.success('✓ AI 神經網路模型與設定已成功儲存！');
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
