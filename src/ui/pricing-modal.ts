import { SUBSCRIPTION_PLANS, SubscriptionManager, type SubscriptionPlanId } from '../core/subscription-tier';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';

/**
 * 💎 PrintMagic 商業化訂閱與定價升級面板
 * Free (NT$ 0) | Pro (NT$ 399/mo) | VIP (NT$ 699/mo)
 */
export class PricingModal {
  private modalEl: HTMLElement;
  private onPlanUpdated?: () => void;

  constructor(onPlanUpdated?: () => void) {
    this.onPlanUpdated = onPlanUpdated;
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'pricingModal';
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.render();
    document.body.appendChild(this.modalEl);
    this.bindEvents();
  }

  public render(): void {
    const currentPlanId = SubscriptionManager.getCurrentPlanId();
    const state = SubscriptionManager.getSubscriptionState();

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 960px; width: 95vw;">
        <div class="pm-modal-header" style="border-bottom: none; padding-bottom: 0;">
          <div style="text-align: center; width: 100%;">
            <span style="display: inline-block; padding: 4px 12px; background: rgba(0, 113, 227, 0.1); color: var(--pm-accent); border-radius: 999px; font-size: 0.76rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">
              Commercial Plans
            </span>
            <h2 class="pm-modal-title" style="font-size: 1.6rem; font-weight: 700;">
              選擇最適合您的 PrintMagic 方案
            </h2>
            <p style="font-size: 0.88rem; color: var(--pm-text-muted); margin: 6px auto 0 auto; max-width: 520px;">
              從個人快印到頂級廣告設計事務所，為您的印刷製版流程注入無限生產力
            </p>
          </div>
          <button class="pm-modal-close" id="btnClosePricing" style="position: absolute; right: 20px; top: 20px;">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 24px 12px;">
          <!-- 3-Column Plan Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
            ${SUBSCRIPTION_PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const isPro = plan.id === 'pro';
              const isVip = plan.id === 'vip';

              let cardBg = 'var(--pm-bg-secondary)';
              let borderStyle = '1px solid var(--pm-border-subtle)';
              let shadowStyle = 'none';

              if (isVip) {
                cardBg = 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(240, 245, 255, 0.98))';
                borderStyle = '2px solid #5856d6';
                shadowStyle = '0 12px 32px rgba(88, 86, 214, 0.15)';
              } else if (isPro) {
                borderStyle = '2px solid var(--pm-accent)';
                shadowStyle = '0 12px 32px rgba(0, 113, 227, 0.12)';
              }

              return `
                <div style="background: ${cardBg}; border: ${borderStyle}; border-radius: 16px; padding: 24px 20px; display: flex; flex-direction: column; justify-content: space-between; position: relative; box-shadow: ${shadowStyle}; transition: transform 0.2s ease;">
                  ${
                    plan.isPopular
                      ? `<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--pm-accent); color: white; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 999px; text-transform: uppercase;">最受設計師歡迎</div>`
                      : ''
                  }
                  ${
                    isVip
                      ? `<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #5856d6, #af52de); color: white; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 999px; text-transform: uppercase;">💎 旗艦商業 AI</div>`
                      : ''
                  }

                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                      <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0; color: var(--pm-text-primary);">${plan.nameZh}</h3>
                      <span style="font-size: 0.75rem; font-weight: 700; color: ${isVip ? '#5856d6' : 'var(--pm-text-muted)'};">${plan.badge}</span>
                    </div>
                    <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 0 0 16px 0; min-height: 34px;">${plan.tagline}</p>

                    <div style="margin-bottom: 20px; display: flex; align-items: baseline; gap: 4px;">
                      <span style="font-size: 1.8rem; font-weight: 800; color: var(--pm-text-primary);">${plan.currency} ${plan.priceMonthly}</span>
                      <span style="font-size: 0.8rem; color: var(--pm-text-muted);">${plan.period}</span>
                    </div>

                    <ul style="list-style: none; padding: 0; margin: 0 0 24px 0; display: flex; flex-direction: column; gap: 10px;">
                      ${plan.features
                        .map(
                          (f) => `
                        <li style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.82rem; color: ${f.included ? 'var(--pm-text-primary)' : 'var(--pm-text-muted)'}; opacity: ${f.included ? '1' : '0.5'};">
                          <span style="font-size: 0.9rem; color: ${f.included ? (f.highlight ? (isVip ? '#5856d6' : 'var(--pm-accent)') : '#34c759') : '#8e8e93'};">${f.included ? '✓' : '✕'}</span>
                          <span style="${f.highlight ? 'font-weight: 600;' : ''}">${f.text}</span>
                        </li>
                      `
                        )
                        .join('')}
                    </ul>
                  </div>

                  <div>
                    ${
                      isCurrent
                        ? `
                      <button class="pm-btn pm-btn-secondary" style="width: 100%; cursor: default; background: rgba(52, 199, 89, 0.1); border-color: rgba(52, 199, 89, 0.3); color: #248a3d; font-weight: 600;">
                        ✓ 目前使用中
                      </button>
                    `
                        : `
                      <button class="pm-btn ${isVip ? 'pm-btn-primary' : isPro ? 'pm-btn-primary' : 'pm-btn-ghost'} btn-select-plan" data-plan="${plan.id}" style="width: 100%; ${isVip ? 'background: linear-gradient(135deg, #5856d6, #af52de); border: none;' : ''}">
                        ${isVip ? '💎 立即升級 VIP' : isPro ? '👑 立即升級 Pro' : '切換至免費版'}
                      </button>
                    `
                    }
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Quota Banner for Subscribed Users -->
          ${
            state.isSubscribed
              ? `
            <div style="margin-top: 20px; padding: 12px 16px; background: rgba(52, 199, 89, 0.08); border: 1px solid rgba(52, 199, 89, 0.2); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
              <div>
                <strong>${state.planName}</strong> 啟用中 · 本月高階 AI 剩餘額度：<strong>${state.monthlyQuotaRemaining} 張</strong>
              </div>
              <span style="color: var(--pm-text-muted); font-size: 0.76rem;">效期至 2026-12-31</span>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const close = () => this.close();
    this.modalEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'btnClosePricing' || target.id === 'pricingBackdrop') {
        close();
      }

      const planBtn = target.closest<HTMLButtonElement>('.btn-select-plan');
      if (planBtn && planBtn.dataset.plan) {
        const selectedPlan = planBtn.dataset.plan as SubscriptionPlanId;
        this.handlePlanSelection(selectedPlan);
      }
    });
  }

  private handlePlanSelection(planId: SubscriptionPlanId): void {
    SubscriptionManager.setPlan(planId);
    const plan = SubscriptionManager.getPlan(planId);
    SoundEffects.purityChime();

    if (planId === 'vip') {
      Toast.success(`💎 恭喜！您已成功升級為【${plan.nameZh}】！解鎖 Fal.ai 8K、Topaz 與 500 張高階 GPU 額度！`);
    } else if (planId === 'pro') {
      Toast.success(`👑 恭喜！您已成功升級為【${plan.nameZh}】！解鎖雙面合版、向量刀模、拼版與 PDF/X-1a！`);
    } else {
      Toast.info(`已切換回【${plan.nameZh}】。`);
    }

    this.render();
    this.close();
    if (this.onPlanUpdated) {
      this.onPlanUpdated();
    }
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
