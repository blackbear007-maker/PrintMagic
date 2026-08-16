import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { AI_MODELS, AiUpscaleClient, type AiModelType } from '../services/ai-upscale-client';
import { VIP_AI_MODELS, VipAiClient, type VipAiModelId } from '../services/vip-ai-client';
import { SubscriptionManager } from '../core/subscription-tier';

/**
 * 🧠 AI 深度學習神經網路模型與 VIP 高階商業引擎設定面板
 */
export class AiSettingsModal {
  private modalEl: HTMLElement;
  private onModelChanged?: () => void;
  private onOpenPricing?: () => void;

  constructor(onModelChanged?: () => void, onOpenPricing?: () => void) {
    this.onModelChanged = onModelChanged;
    this.onOpenPricing = onOpenPricing;
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'aiSettingsModal';
    this.modalEl.className = 'pm-modal';
    this.render();
    document.body.appendChild(this.modalEl);
    this.bindEvents();
  }

  public render(): void {
    const isVip = SubscriptionManager.canUseFeature('vipAi');
    const currentModel = AiUpscaleClient.getStoredModel();
    const currentVipModel = VipAiClient.getSelectedModelId();
    const currentToken = AiUpscaleClient.getStoredToken();

    this.modalEl.innerHTML = `
      <div class="pm-modal-backdrop" id="aiSettingsBackdrop"></div>
      <div class="pm-modal-dialog" style="max-width: 600px;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.5rem;">🧠</span>
            <div>
              <h3 class="pm-modal-title">AI 超解析度神經網路模型設定</h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                開源免費模型 與 💎 VIP 頂級商業高階 GPU 影像重建引擎
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseAiSettings">✕</button>
        </div>

        <div class="pm-modal-body" style="display: flex; flex-direction: column; gap: 18px; max-height: 70vh; overflow-y: auto;">
          <!-- 1. VIP Commercial High-End Models -->
          <div style="background: linear-gradient(145deg, rgba(88, 86, 214, 0.05), rgba(175, 82, 222, 0.08)); border: 1.5px solid rgba(88, 86, 214, 0.3); border-radius: 12px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <label style="font-size: 0.88rem; font-weight: 700; color: #5856d6; display: flex; align-items: center; gap: 6px;">
                <span>💎</span> VIP 頂級商業付費 AI 引擎 (NT$ 699 專屬)
              </label>
              ${
                !isVip
                  ? `<button class="pm-btn pm-btn-sm" id="btnAiModalUpgradeVip" style="background: linear-gradient(135deg, #5856d6, #af52de); color: white; border: none; font-size: 0.72rem; padding: 2px 8px;">升級 VIP 解鎖</button>`
                  : `<span style="font-size: 0.72rem; color: #34c759; font-weight: 600;">✓ VIP 已授權</span>`
              }
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${VIP_AI_MODELS.map((m) => {
                const isSelected = isVip && currentVipModel === m.id;
                return `
                  <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--pm-bg-primary); border: 1px solid ${isSelected ? '#5856d6' : 'var(--pm-border-subtle)'}; border-radius: var(--pm-radius-sm); cursor: ${isVip ? 'pointer' : 'not-allowed'}; opacity: ${isVip ? '1' : '0.7'};">
                    <input type="radio" name="aiModelChoice" value="vip:${m.id}" ${!isVip ? 'disabled' : ''} ${isSelected ? 'checked' : ''} style="margin-top: 3px;" />
                    <div style="flex: 1;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; font-size: 0.88rem; color: var(--pm-text-primary);">${m.name}</span>
                        <span style="font-size: 0.72rem; color: #5856d6; font-weight: 600;">${m.badge}</span>
                      </div>
                      <div style="font-size: 0.76rem; color: var(--pm-text-muted); margin-top: 2px;">${m.tagline}</div>
                      <div style="font-size: 0.7rem; color: var(--pm-text-secondary); margin-top: 4px; display: flex; gap: 12px;">
                        <span>⚡ 延遲：${m.estLatency}</span>
                        <span>💰 算力成本：${m.costEstimate}</span>
                      </div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 2. Standard Free / Pro Open-Source Models -->
          <div>
            <label style="font-size: 0.85rem; font-weight: 600; color: var(--pm-text-primary); display: block; margin-bottom: 8px;">
              🌐 標準開源 AI 模型 (Free / Pro 免費包含)
            </label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${AI_MODELS.map(
                (m) => `
                <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--pm-bg-secondary); border: 1px solid var(--pm-border-subtle); border-radius: var(--pm-radius-sm); cursor: pointer;">
                  <input type="radio" name="aiModelChoice" value="std:${m.id}" ${currentModel === m.id ? 'checked' : ''} style="margin-top: 3px;" />
                  <div>
                    <div style="font-weight: 600; font-size: 0.88rem; color: var(--pm-text-primary);">${m.name}</div>
                    <div style="font-size: 0.76rem; color: var(--pm-text-muted); margin-top: 2px;">${m.desc}</div>
                  </div>
                </label>
              `
              ).join('')}
            </div>
          </div>

          <!-- 3. Free Token Configuration -->
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
              value="${currentToken}"
              placeholder="hf_xxxxxxxxxxxxxxxxxxxx (留空則使用本機/公共共享通道)"
              style="width: 100%; padding: 8px 12px; font-family: monospace; font-size: 0.82rem; background: var(--pm-bg-primary); border: 1px solid var(--pm-border-subtle); border-radius: var(--pm-radius-sm); color: var(--pm-text-primary); box-sizing: border-box;"
            />
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
      if (target.id === 'btnCloseAiSettings' || target.id === 'btnCancelAiSettings' || target.id === 'aiSettingsBackdrop') {
        close();
      }

      if (target.id === 'btnAiModalUpgradeVip') {
        this.close();
        if (this.onOpenPricing) this.onOpenPricing();
      }

      if (target.id === 'btnSaveAiSettings') {
        const selectedRadio = this.modalEl.querySelector<HTMLInputElement>('input[name="aiModelChoice"]:checked');
        if (selectedRadio) {
          const val = selectedRadio.value;
          if (val.startsWith('vip:')) {
            const vipId = val.replace('vip:', '') as VipAiModelId;
            VipAiClient.setSelectedModelId(vipId);
          } else if (val.startsWith('std:')) {
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
    this.modalEl.classList.add('active');
    SoundEffects.sliderTick();
  }

  public close(): void {
    this.modalEl.classList.remove('active');
  }
}
