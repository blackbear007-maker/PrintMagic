import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { AI_MODELS, AiUpscaleClient, type AiModelType } from '../services/ai-upscale-client';

/**
 * 🧠 AI 深度學習神經網路模型與免費金鑰設定面板
 */
export class AiSettingsModal {
  private modalEl: HTMLElement;
  private onModelChanged?: () => void;

  constructor(onModelChanged?: () => void) {
    this.onModelChanged = onModelChanged;
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'aiSettingsModal';
    this.modalEl.className = 'pm-modal';
    this.modalEl.innerHTML = `
      <div class="pm-modal-backdrop" id="aiSettingsBackdrop"></div>
      <div class="pm-modal-dialog" style="max-width: 540px;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.5rem;">🧠</span>
            <div>
              <h3 class="pm-modal-title">AI 深度學習超解析度模型設定</h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                直連 Hugging Face 與 Gradio 免費開源 SOTA 影像重構模型
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseAiSettings">✕</button>
        </div>

        <div class="pm-modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Model Selection -->
          <div>
            <label style="font-size: 0.85rem; font-weight: 600; color: var(--pm-text-primary); display: block; margin-bottom: 8px;">
              選擇 AI 重建模型架構
            </label>
            <div style="display: flex; flex-direction: column; gap: 8px;" id="aiModelRadioGroup">
              ${AI_MODELS.map(
                (m) => `
                <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--pm-bg-secondary); border: 1px solid var(--pm-border-subtle); border-radius: var(--pm-radius-sm); cursor: pointer;">
                  <input type="radio" name="aiModelChoice" value="${m.id}" style="margin-top: 3px;" />
                  <div>
                    <div style="font-weight: 600; font-size: 0.88rem; color: var(--pm-text-primary);">${m.name}</div>
                    <div style="font-size: 0.76rem; color: var(--pm-text-muted); margin-top: 2px;">${m.desc}</div>
                  </div>
                </label>
              `
              ).join('')}
            </div>
          </div>

          <!-- Free Token Configuration -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label style="font-size: 0.85rem; font-weight: 600; color: var(--pm-text-primary);">
                自訂 Hugging Face 存取權杖 (選填 · 100% 免費)
              </label>
              <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" style="font-size: 0.76rem; color: var(--pm-accent); text-decoration: none;">
                🔑 免費獲取 Token ➔
              </a>
            </div>
            <input
              type="password"
              id="inputHfToken"
              placeholder="hf_xxxxxxxxxxxxxxxxxxxx (留空則使用本機/公共共享通道)"
              style="width: 100%; padding: 8px 12px; font-family: monospace; font-size: 0.82rem; background: var(--pm-bg-primary); border: 1px solid var(--pm-border-subtle); border-radius: var(--pm-radius-sm); color: var(--pm-text-primary); box-sizing: border-box;"
            />
            <p style="font-size: 0.72rem; color: var(--pm-text-muted); margin: 4px 0 0 0;">
              💡 填入個人免費 Token 可享受專屬無佇列加速，資料僅保存在您的瀏覽器本機中。
            </p>
          </div>

          <!-- Benchmark Info Box -->
          <div style="padding: 10px 12px; background: rgba(0, 113, 227, 0.05); border: 1px solid rgba(0, 113, 227, 0.2); border-radius: var(--pm-radius-sm); font-size: 0.78rem; color: var(--pm-text-secondary); line-height: 1.4;">
            🛡️ <strong>四階自適應備援保證</strong>：系統自動依序嘗試「本機後端 ➔ 雲端 REST ➔ Gradio 開源節點 ➔ 本機 8x 金字塔」。無論網路狀況如何，您的圖片皆能 100% 成功放大！
          </div>
        </div>

        <div class="pm-modal-footer">
          <button class="pm-btn pm-btn-ghost" id="btnCancelAiSettings">取消</button>
          <button class="pm-btn pm-btn-primary" id="btnSaveAiSettings">儲存設定</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);
    this.bindEvents();
  }

  private bindEvents(): void {
    const close = () => this.close();
    this.modalEl.querySelector('#btnCloseAiSettings')?.addEventListener('click', close);
    this.modalEl.querySelector('#btnCancelAiSettings')?.addEventListener('click', close);
    this.modalEl.querySelector('#aiSettingsBackdrop')?.addEventListener('click', close);

    this.modalEl.querySelector('#btnSaveAiSettings')?.addEventListener('click', () => {
      const selectedRadio = this.modalEl.querySelector<HTMLInputElement>('input[name="aiModelChoice"]:checked');
      if (selectedRadio) {
        AiUpscaleClient.setStoredModel(selectedRadio.value as AiModelType);
      }

      const inputToken = this.modalEl.querySelector<HTMLInputElement>('#inputHfToken');
      if (inputToken) {
        AiUpscaleClient.setStoredToken(inputToken.value);
      }

      SoundEffects.purityChime();
      Toast.success('✓ AI 神經網路模型與設定已成功儲存！');
      this.close();
      if (this.onModelChanged) this.onModelChanged();
    });
  }

  public open(): void {
    const currentModel = AiUpscaleClient.getStoredModel();
    const currentToken = AiUpscaleClient.getStoredToken();

    const radios = this.modalEl.querySelectorAll<HTMLInputElement>('input[name="aiModelChoice"]');
    radios.forEach((r) => {
      r.checked = r.value === currentModel;
    });

    const inputToken = this.modalEl.querySelector<HTMLInputElement>('#inputHfToken');
    if (inputToken) {
      inputToken.value = currentToken;
    }

    this.modalEl.classList.add('active');
    SoundEffects.sliderTick();
  }

  public close(): void {
    this.modalEl.classList.remove('active');
  }
}
