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
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="xiaoxiang/idle.webp" alt="小象" style="width: 52px; height: 52px; object-fit: contain; object-position: center bottom; flex-shrink: 0;" />
            <div>
              <h3 class="pm-modal-title" style="font-size: 1.22rem; font-weight: 800;">
                小象陪您 30 秒上手【印象魔法】
              </h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                只需 3 個直覺步驟，從相片變身符合印刷標準的完美成品
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseOnboarding"><img src="icons/shared/close.webp" alt="" class="pm-icon-img" /></button>
        </div>

        <div class="pm-modal-body" style="padding: 20px 16px;">
          <!-- 3 Visual Steps Grid -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Step 1 -->
            <div style="display: flex; gap: 16px; padding: 16px; background: var(--pm-bg-secondary); border: 1px solid var(--pm-border-subtle); border-radius: 14px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(60, 30, 140, 0.1); color: var(--pm-accent-blue); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 800; flex-shrink: 0;">
                1
              </div>
              <div>
                <h4 style="font-size: 0.96rem; font-weight: 700; color: var(--pm-text-primary); margin: 0 0 4px 0;">
                  <img src="icons/shared/camera.webp" alt="" class="pm-icon-img" /> 選擇相片或直接拖進畫面
                </h4>
                <p style="font-size: 0.8rem; color: var(--pm-text-secondary); margin: 0; line-height: 1.45;">
                  從相簿選圖或直接拖進畫面，系統依圖片比例自動挑選<strong>版型</strong>（可再手動切換），並依版型加上出血。
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
                  <img src="icons/shared/magnifier.webp" alt="" class="pm-icon-img" /> 自動放大補足 DPI 與 100 分印前健檢
                </h4>
                <p style="font-size: 0.8rem; color: var(--pm-text-secondary); margin: 0; line-height: 1.45;">
                  系統在<strong>依目標 DPI 自動放大</strong>、USM 銳化與 CMYK 墨量安全防護。看到懸浮膠囊亮起 <strong style="color: var(--pm-status-success);">100分 <img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" /> 完美就緒</strong> 即可安心輸出！
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
                  <img src="icons/shared/package-box.webp" alt="" class="pm-icon-img" /> 一鍵下載標準 PDF 或超商列印檔
                </h4>
                <p style="font-size: 0.8rem; color: var(--pm-text-secondary); margin: 0; line-height: 1.45;">
                  點擊<strong>「<img src="icons/shared/star-cta.webp" alt="" class="pm-icon-img" /> 一鍵下載標準印刷檔 (PDF)」</strong>直接送交印刷廠出機，或點擊<strong>「<img src="icons/shared/store.webp" alt="" class="pm-icon-img" /> 超商列印檔案產生器」</strong>下載排版好的檔案，再透過超商官網上傳取得取件碼。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="pm-modal-footer" style="justify-content: space-between;">
          <span style="font-size: 0.76rem; color: var(--pm-text-muted);">
            💡 預設使用自建雲端服務（AI 放大、CMYK 分色等），服務離線時自動改用本機演算法；不想上傳圖片請切到【本機】
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
    SoundEffects.purityChime();
  }

  public close(): void {
    this.modalEl.style.display = 'none';
  }
}
