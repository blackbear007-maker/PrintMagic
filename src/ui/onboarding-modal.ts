import { SoundEffects } from '../core/sound-effects';

/**
 * 💡 PrintMagic 新手 30 秒 3 步速成指南彈窗 (Apple HIG Onboarding Modal)
 */
export class OnboardingModal {
  private modalEl: HTMLElement;

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'onboardingModal';
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.render();
    document.body.appendChild(this.modalEl);
    this.bindEvents();
  }

  public render(): void {
    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 620px;">
        <div class="pm-modal-header" style="border-bottom: none; padding-bottom: 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.5rem;">💡</span>
            <div>
              <h3 class="pm-modal-title" style="font-size: 1.25rem; font-weight: 700;">
                PrintMagic 30 秒上手指南
              </h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                只需 3 個直覺步驟，從 AI 照片直接變身為符合印刷廠規範的完美印刷品
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseOnboarding">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 20px 16px;">
          <!-- 3 Visual Steps Grid -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Step 1 -->
            <div style="display: flex; gap: 16px; padding: 16px; background: var(--pm-bg-secondary); border: 1px solid var(--pm-border-subtle); border-radius: 14px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(0, 113, 227, 0.1); color: var(--pm-accent-blue); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 800; flex-shrink: 0;">
                1
              </div>
              <div>
                <h4 style="font-size: 0.96rem; font-weight: 700; color: var(--pm-text-primary); margin: 0 0 4px 0;">
                  📸 丟入圖片或點選情境卡
                </h4>
                <p style="font-size: 0.8rem; color: var(--pm-text-secondary); margin: 0; line-height: 1.45;">
                  直接將 Midjourney、Stable Diffusion 照片拖入畫面，或點選<strong>「印名片 / 印貼紙 / 印海報」</strong>，系統自動適配最佳印刷尺寸。
                </p>
              </div>
            </div>

            <!-- Step 2 -->
            <div style="display: flex; gap: 16px; padding: 16px; background: var(--pm-bg-secondary); border: 1px solid var(--pm-border-subtle); border-radius: 14px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(52, 199, 89, 0.1); color: var(--pm-status-success); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 800; flex-shrink: 0;">
                2
              </div>
              <div>
                <h4 style="font-size: 0.96rem; font-weight: 700; color: var(--pm-text-primary); margin: 0 0 4px 0;">
                  🔍 自動 8x 放大與 100 分印前檢測
                </h4>
                <p style="font-size: 0.8rem; color: var(--pm-text-secondary); margin: 0; line-height: 1.45;">
                  系統在<strong>本機端 0.1 秒自動執行 8x 金字塔超解析度</strong>與 CMYK 溢墨防護。右側分數達到 <strong style="color: var(--pm-status-success);">88+ 綠燈</strong> 即可安心送印！
                </p>
              </div>
            </div>

            <!-- Step 3 -->
            <div style="display: flex; gap: 16px; padding: 16px; background: var(--pm-bg-secondary); border: 1px solid var(--pm-border-subtle); border-radius: 14px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(255, 149, 0, 0.1); color: var(--pm-status-warning); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 800; flex-shrink: 0;">
                3
              </div>
              <div>
                <h4 style="font-size: 0.96rem; font-weight: 700; color: var(--pm-text-primary); margin: 0 0 4px 0;">
                  📦 一鍵超商 30 秒取件 或 印刷廠出機
                </h4>
                <p style="font-size: 0.8rem; color: var(--pm-text-secondary); margin: 0; line-height: 1.45;">
                  點擊<strong>「🏪 超商立印」</strong>產生 7-11 / 全家雲端碼，或點擊<strong>「🏭 直通送印」</strong>一鍵對比健豪/卡之屋報價並送印。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="pm-modal-footer" style="justify-content: space-between;">
          <span style="font-size: 0.76rem; color: var(--pm-text-muted);">
            💡 支援 100% 離線隱私保護，商業作品不聯網
          </span>
          <button class="pm-btn pm-btn-primary" id="btnStartNow" style="padding: 8px 24px;">
            開始創作 ➔
          </button>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const close = () => this.close();
    this.modalEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (
        target.id === 'btnCloseOnboarding' ||
        target === this.modalEl ||
        target.id === 'btnStartNow'
      ) {
        close();
      }
    });
  }

  public open(): void {
    this.render();
    this.modalEl.style.display = 'flex';
    requestAnimationFrame(() => this.modalEl.classList.add('pm-modal-open'));
    SoundEffects.purityChime();
  }

  public close(): void {
    this.modalEl.classList.remove('pm-modal-open');
    setTimeout(() => {
      this.modalEl.style.display = 'none';
    }, 200);
  }
}
