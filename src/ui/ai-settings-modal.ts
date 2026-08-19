import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { AI_MODELS, AiUpscaleClient, type AiModelType } from '../services/ai-upscale-client';
import { VIP_AI_MODELS, VipAiClient, type VipAiModelId } from '../services/vip-ai-client';
import { SubscriptionManager } from '../core/subscription-tier';

/**
 * 🧠 AI 深度學習神經網路模型與 VIP 高階商業引擎設定面板
 * 雙欄佈局：左側 (Free & Pro 標準開源模型) | 右側 (VIP 頂級商業付費引擎)
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
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
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
      <div class="pm-modal-dialog" style="max-width: 880px; width: 92vw;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.6rem;">🧠</span>
            <div>
              <h3 class="pm-modal-title">AI 超解析度神經網路模型設定</h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                左側開源免費模型 (Free / Pro 包含) · 右側 💎 VIP 頂級商業高階 GPU 影像重建引擎
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseAiSettings">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 20px 24px; max-height: 75vh; overflow-y: auto;">
          <div class="pm-ai-modal-grid">
            
            <!-- LEFT COLUMN: Standard Free / Pro Open-Source Models -->
            <div style="display: flex; flex-direction: column; height: 100%;">
              <div style="background: rgba(0, 0, 0, 0.02); border: 1.5px solid var(--pm-border-subtle); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 14px; height: 100%; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="font-size: 0.9rem; font-weight: 700; color: var(--pm-text-primary); display: flex; align-items: center; gap: 6px;">
                    <span>🌐</span> 開源標準模型 (Free / Pro)
                  </label>
                  <span style="font-size: 0.72rem; color: var(--pm-status-success); font-weight: 700; background: rgba(52, 199, 89, 0.12); padding: 3px 9px; border-radius: 12px;">永久免費包含</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${AI_MODELS.map(
                    (m) => `
                    <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: #ffffff; border: 1.5px solid ${currentModel === m.id ? 'var(--pm-accent-blue)' : 'var(--pm-border-subtle)'}; border-radius: var(--pm-radius-sm); cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);">
                      <input type="radio" name="aiModelChoice" value="std:${m.id}" ${currentModel === m.id ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--pm-accent-blue);" />
                      <div>
                        <div style="font-weight: 700; font-size: 0.86rem; color: var(--pm-text-primary);">${m.name}</div>
                        <div style="font-size: 0.75rem; color: var(--pm-text-muted); margin-top: 2px; line-height: 1.35;">${m.desc}</div>
                      </div>
                    </label>
                  `
                  ).join('')}
                </div>

                <!-- Hugging Face Token Configuration -->
                <div style="margin-top: auto; padding-top: 14px; border-top: 1px solid var(--pm-border-subtle);">
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
                    placeholder="hf_xxxxxxxxxxxxxxxxxxxx (留空使用共享通道)"
                    style="width: 100%; padding: 7px 10px; font-family: monospace; font-size: 0.78rem; background: #ffffff; border: 1px solid var(--pm-border-subtle); border-radius: var(--pm-radius-sm); color: var(--pm-text-primary); box-sizing: border-box;"
                  />
                </div>
              </div>
            </div>

            <!-- RIGHT COLUMN: VIP Commercial High-End Models -->
            <div style="display: flex; flex-direction: column; height: 100%;">
              <div style="background: linear-gradient(145deg, rgba(88, 86, 214, 0.06), rgba(175, 82, 222, 0.09)); border: 1.5px solid rgba(88, 86, 214, 0.35); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 14px; height: 100%; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="font-size: 0.9rem; font-weight: 700; color: #5856d6; display: flex; align-items: center; gap: 6px;">
                    <span>💎</span> VIP 頂級商業引擎 (NT$ 699)
                  </label>
                  ${
                    !isVip
                      ? `<button class="pm-btn pm-btn-sm" id="btnAiModalUpgradeVip" style="background: linear-gradient(135deg, #5856d6, #af52de); color: white; border: none; font-size: 0.72rem; padding: 3px 10px; border-radius: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(88, 86, 214, 0.35);">升級 VIP 解鎖</button>`
                      : `<span style="font-size: 0.72rem; color: #34c759; font-weight: 700; background: rgba(52, 199, 89, 0.15); padding: 3px 9px; border-radius: 12px;">✓ VIP 已授權</span>`
                  }
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${VIP_AI_MODELS.map((m) => {
                    const isSelected = isVip && currentVipModel === m.id;
                    return `
                      <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: #ffffff; border: 1.5px solid ${isSelected ? '#5856d6' : 'rgba(88, 86, 214, 0.2)'}; border-radius: var(--pm-radius-sm); cursor: ${isVip ? 'pointer' : 'not-allowed'}; opacity: ${isVip ? '1' : '0.85'}; box-shadow: 0 1px 3px rgba(88, 86, 214, 0.05); transition: all 0.15s ease;">
                        <input type="radio" name="aiModelChoice" value="vip:${m.id}" ${!isVip ? 'disabled' : ''} ${isSelected ? 'checked' : ''} style="margin-top: 3px; accent-color: #5856d6;" />
                        <div style="flex: 1;">
                          <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; font-size: 0.86rem; color: var(--pm-text-primary);">${m.name}</span>
                            <span style="font-size: 0.7rem; color: #5856d6; font-weight: 700; background: rgba(88, 86, 214, 0.1); padding: 2px 6px; border-radius: 4px;">${m.badge}</span>
                          </div>
                          <div style="font-size: 0.75rem; color: var(--pm-text-muted); margin-top: 2px; line-height: 1.35;">${m.tagline}</div>
                          <div style="font-size: 0.68rem; color: var(--pm-text-secondary); margin-top: 6px; display: flex; gap: 12px; font-weight: 500;">
                            <span>⚡ 延遲：${m.estLatency}</span>
                            <span>💰 算力：${m.costEstimate}</span>
                          </div>
                        </div>
                      </label>
                    `;
                  }).join('')}
                </div>

                <div style="margin-top: auto; padding: 8px 10px; background: rgba(88, 86, 214, 0.08); border-radius: 8px; font-size: 0.72rem; color: #5856d6; line-height: 1.35;">
                  💡 <strong>VIP 專屬權益</strong>：獨享頂規 NVIDIA A100 GPU 叢集極速推理與高階去模糊修復。
                </div>
              </div>
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
    this.modalEl.style.display = 'flex';
    this.modalEl.classList.add('pm-modal-open');
    SoundEffects.sliderTick();
  }

  public close(): void {
    this.modalEl.style.display = 'none';
    this.modalEl.classList.remove('pm-modal-open');
  }
}
