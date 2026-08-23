import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { AI_MODELS, AiUpscaleClient, type AiModelType } from '../services/ai-upscale-client';
import { QuotaRouter, type EngineCategory, type ProviderQuotaConfig } from '../services/quota-router';
import { NetworkGuard } from '../services/network-guard';
import { SubscriptionManager } from '../core/subscription-tier';

/**
 * 🧠 免費 AI 引擎與開放 API 設定面板 (支援 8 大領域智慧額度品質路由與商業隱私防護罩)
 */
export class AiSettingsModal {
  private modalEl: HTMLElement;
  private activeCategory: EngineCategory = 'upscale';
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
    const currentModel = AiUpscaleClient.getStoredModel();
    const isPrivacyShieldActive = NetworkGuard.isPrivacyShieldActive();

    const activeProviders = QuotaRouter.getProviders(this.activeCategory);
    const catMeta = QuotaRouter.CATEGORY_NAMES;

    const renderProviderRow = (p: ProviderQuotaConfig) => {
      const pct = QuotaRouter.getRemainingPercent(p);
      const isLow = pct <= 10 && !p.isLocalUnlimited;
      const isExhausted = pct === 0 && !p.isLocalUnlimited;
      const statusBadge = isPrivacyShieldActive && !p.isLocalUnlimited
        ? '<span style="font-size:0.68rem; color:#8e8e93; font-weight:700; background:rgba(142,142,147,0.1); padding:2px 6px; border-radius:4px;">🔒 隱私防護已停用雲端</span>'
        : p.isLocalUnlimited
        ? '<span style="font-size:0.68rem; color:#5856d6; font-weight:700; background:rgba(88,86,214,0.1); padding:2px 6px; border-radius:4px;">♾️ 本機無限制備援</span>'
        : isExhausted
        ? '<span style="font-size:0.68rem; color:#ff3b30; font-weight:700; background:rgba(255,59,48,0.1); padding:2px 6px; border-radius:4px;">🔴 額度耗盡 (已自動轉跳)</span>'
        : isLow
        ? '<span style="font-size:0.68rem; color:#ff9500; font-weight:700; background:rgba(255,149,0,0.1); padding:2px 6px; border-radius:4px;">🟡 額度 ≤10% (自動切換中)</span>'
        : '<span style="font-size:0.68rem; color:#34c759; font-weight:700; background:rgba(52,199,89,0.1); padding:2px 6px; border-radius:4px;">🟢 首選使用中</span>';

      const barColor = p.isLocalUnlimited ? '#5856d6' : isLow ? '#ff9500' : isExhausted ? '#ff3b30' : '#34c759';

      return `
        <div style="background: #ffffff; border: 1px solid var(--pm-border-subtle); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #0071e3; background: rgba(0,113,227,0.08); padding: 2px 6px; border-radius: 4px;">品質分 ${p.qualityScore}</span>
              <strong style="font-size: 0.84rem; color: var(--pm-text-primary);">${p.name}</strong>
              <span style="font-size: 0.7rem; color: var(--pm-text-muted);">(${p.provider})</span>
            </div>
            ${statusBadge}
          </div>
          <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">${p.description}</div>
          ${!p.isLocalUnlimited ? `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px;">
              <div style="flex: 1; height: 6px; background: rgba(0,0,0,0.06); border-radius: 3px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: ${barColor}; border-radius: 3px; transition: width 0.3s ease;"></div>
              </div>
              <span style="font-size: 0.68rem; font-family: monospace; color: var(--pm-text-secondary); font-weight: 600;">
                ${pct}% 剩餘 (${p.totalQuota - p.usedQuota} / ${p.totalQuota})
              </span>
            </div>
          ` : ''}
        </div>
      `;
    };

    const categories: EngineCategory[] = ['upscale', 'matting', 'inpainting', 'vectorize', 'lowlight', 'crop', 'ocr', 'geo'];

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 700px; width: 94vw;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.6rem;">⚡</span>
            <div>
              <h3 class="pm-modal-title">全領域免費 AI 引擎與智慧額度品質路由</h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                依品質排序優先呼叫，額度 ≤10% 或網路異常自動無感切換，耗盡 100% 轉本機 0ms 備援
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseAiSettings">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 16px 20px; max-height: 76vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;">
          <!-- Privacy Shield Switch (Risk Mitigation & PRO/VIP Privilege) -->
          <div style="background: ${isPrivacyShieldActive ? 'linear-gradient(135deg, rgba(88,86,214,0.12) 0%, rgba(0,113,227,0.08) 100%)' : 'rgba(0,0,0,0.02)'}; border: 1.5px solid ${isPrivacyShieldActive ? 'var(--pm-accent-purple, #5856d6)' : 'var(--pm-border-subtle)'}; border-radius: 12px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.4rem;">🔒</span>
              <div>
                <div style="font-size: 0.86rem; font-weight: 700; color: var(--pm-text-primary); display: flex; align-items: center; gap: 6px;">
                  <span>商業機密 100% 離線純本機 / 私有自建隱私保護盾</span>
                  <span style="font-size: 0.68rem; background: linear-gradient(135deg, #ff9500 0%, #ff2d55 100%); color: #ffffff; padding: 1px 6px; border-radius: 4px; font-weight: 800;">👑 PRO / 💎 VIP 專屬</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--pm-text-muted); margin-top: 1px;">
                  開啟後立即阻斷所有外部公用 API，OCR 與向量運算強制 100% 走私有自建 Tesseract / 本機三次貝茲 (符合企業資安規範)
                </div>
              </div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; margin-left: 12px; cursor: pointer;">
              <input type="checkbox" id="togglePrivacyShield" ${isPrivacyShieldActive ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;" />
              <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isPrivacyShieldActive ? '#34c759' : '#ccc'}; border-radius: 24px; transition: .3s;"></span>
              <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${isPrivacyShieldActive ? '23px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .3s;"></span>
            </label>
          </div>

          <!-- 0. Category Selector Tabs -->
          <div style="display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--pm-border-subtle);">
            ${categories.map((cat) => `
              <button class="pm-quota-tab-btn" data-cat="${cat}" style="font-size: 0.74rem; padding: 5px 9px; border-radius: 6px; border: 1px solid ${this.activeCategory === cat ? 'var(--pm-accent-blue)' : 'var(--pm-border-subtle)'}; background: ${this.activeCategory === cat ? 'rgba(0,113,227,0.08)' : '#ffffff'}; color: ${this.activeCategory === cat ? 'var(--pm-accent-blue)' : 'var(--pm-text-primary)'}; font-weight: ${this.activeCategory === cat ? '700' : '500'}; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span>${catMeta[cat].icon}</span>
                <span>${catMeta[cat].name.split('與')[0]}</span>
              </button>
            `).join('')}
          </div>

          <!-- Dynamic Quota & Quality Routing Monitor Panel -->
          <div style="background: linear-gradient(135deg, rgba(0,113,227,0.05) 0%, rgba(88,86,214,0.05) 100%); border: 1.5px solid rgba(0,113,227,0.2); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 0.86rem; font-weight: 700; color: var(--pm-text-primary); display: flex; align-items: center; gap: 6px;">
                  <span>${catMeta[this.activeCategory].icon}</span> ${catMeta[this.activeCategory].name}
                </span>
                <span style="font-size: 0.72rem; color: var(--pm-text-muted);">${catMeta[this.activeCategory].desc}</span>
              </div>
              <button id="btnResetQuotaCounter" class="pm-btn pm-btn-xs pm-btn-ghost" style="font-size: 0.7rem;">🔄 重設額度計數</button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${activeProviders.map(renderProviderRow).join('')}
            </div>
          </div>

          <!-- 1. AI Super-Resolution Default Model Selection -->
          <div style="background: rgba(0, 0, 0, 0.02); border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="font-size: 0.86rem; font-weight: 700; color: var(--pm-text-primary); display: flex; align-items: center; gap: 6px;">
                <span>🌐</span> 預設優先超解析度模型
              </label>
              <span style="font-size: 0.7rem; color: var(--pm-status-success); font-weight: 700; background: rgba(52, 199, 89, 0.12); padding: 2px 8px; border-radius: 10px;">✓ 100% 免費開放</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              ${AI_MODELS.map(
                (m) => `
                <label style="display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1.5px solid ${currentModel === m.id ? 'var(--pm-accent-blue)' : 'var(--pm-border-subtle)'}; border-radius: var(--pm-radius-sm); cursor: pointer; transition: all 0.15s ease;">
                  <input type="radio" name="aiModelChoice" value="std:${m.id}" ${currentModel === m.id ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--pm-accent-blue);" />
                  <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 0.8rem; color: var(--pm-text-primary);">${m.name}</div>
                    <div style="font-size: 0.7rem; color: var(--pm-text-muted); margin-top: 1px; line-height: 1.25;">${m.desc}</div>
                  </div>
                </label>
              `
              ).join('')}
            </div>

            <!-- 100% Zero-Registration & Zero-Key Open Architecture Guarantee -->
            <div style="background: rgba(52, 199, 89, 0.06); border: 1px solid rgba(52, 199, 89, 0.25); border-radius: 8px; padding: 10px 12px; margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.1rem;">✨</span>
                <div>
                  <div style="font-size: 0.78rem; font-weight: 700; color: var(--pm-text-primary);">
                    100% 免申請、免註冊、零金鑰全自動架構
                  </div>
                  <div style="font-size: 0.7rem; color: var(--pm-text-muted); margin-top: 1px;">
                    所有 8 大印前領域均由開源公共鏡像、開放 REST 網關與本機 0ms 演算法自動託管，開箱即用無需任何 API Key
                  </div>
                </div>
              </div>
              <span style="font-size: 0.72rem; color: #34c759; font-weight: 700; background: #ffffff; border: 1px solid rgba(52,199,89,0.3); padding: 3px 8px; border-radius: 12px;">
                ✓ 零設定啟用中
              </span>
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

      if (target.id === 'togglePrivacyShield') {
        const checkbox = target as HTMLInputElement;

        // Check if user has PRO / VIP permission
        if (checkbox.checked && !SubscriptionManager.canUseFeature('privacyShield')) {
          checkbox.checked = false;
          SoundEffects.sliderTick();
          Toast.error('🔒「商業機密 100% 離線隱私保護盾」為 👑 PRO / 💎 VIP 專屬特權，已為您開啟方案升級面板！');
          if (this.onOpenPricing) {
            this.close();
            this.onOpenPricing();
          }
          return;
        }

        NetworkGuard.setPrivacyShield(checkbox.checked);
        SoundEffects.sliderTick();
        if (checkbox.checked) {
          Toast.success('🔒 商業隱私防護罩已啟動：已全面阻斷外部公用 API，強制 100% 私有自建 Tesseract / 本機運算！');
        } else {
          Toast.info('🌐 已恢復 70/30 智慧分流與品質優先路由。');
        }
        this.render();
        return;
      }

      const tabBtn = target.closest<HTMLElement>('.pm-quota-tab-btn');
      if (tabBtn) {
        const cat = tabBtn.dataset.cat as EngineCategory;
        if (cat) {
          this.activeCategory = cat;
          SoundEffects.sliderTick();
          this.render();
          return;
        }
      }

      if (target.id === 'btnCloseAiSettings' || target.id === 'btnCancelAiSettings' || target.id === 'aiSettingsModal') {
        close();
      }

      if (target.id === 'btnResetQuotaCounter') {
        QuotaRouter.resetQuota();
        SoundEffects.sliderTick();
        Toast.success('✓ 已重設所有 8 大領域之引擎使用額度計數！');
        this.render();
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

        SoundEffects.purityChime();
        Toast.success('✓ 全領域 AI 引擎與智慧額度路由設定已成功儲存！');
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
