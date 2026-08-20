import { SoundEffects } from '../core/sound-effects';

/**
 * ✨ PrintMagic 測試版全功能免費開放說明面板
 */
export class PricingModal {
  private modalEl: HTMLElement;

  constructor(_onPlanUpdated?: () => void) {
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'pricingModal';
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.render();
    document.body.appendChild(this.modalEl);
    this.bindEvents();
  }

  public render(): void {
    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 860px; width: 95vw;">
        <div class="pm-modal-header" style="border-bottom: none; padding-bottom: 0;">
          <div style="text-align: center; width: 100%;">
            <span style="display: inline-block; padding: 4px 14px; background: rgba(52, 199, 89, 0.12); color: #248a3d; border: 1px solid rgba(52, 199, 89, 0.3); border-radius: 999px; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 8px;">
              ✨ Public Beta 測試版
            </span>
            <h2 class="pm-modal-title" style="font-size: 1.6rem; font-weight: 700;">
              全功能免費開放 · 享受頂級印刷準備體驗
            </h2>
            <p style="font-size: 0.88rem; color: var(--pm-text-muted); margin: 6px auto 0 auto; max-width: 540px; line-height: 1.45;">
              目前 PrintMagic 處於公開測試階段，所有 AI 魔法、專業製版與工業級出圖功能皆 <strong>100% 免費開放</strong>，無須訂閱即可直接使用！
            </p>
          </div>
          <button class="pm-modal-close" id="btnClosePricing" style="position: absolute; right: 20px; top: 20px;">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 24px 16px;">
          <!-- 3-Column Feature Overview Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
            <!-- Column 1: AI Superpowers -->
            <div style="background: rgba(0, 113, 227, 0.04); border: 1.5px solid rgba(0, 113, 227, 0.2); border-radius: 16px; padding: 22px 18px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                  <span style="font-size: 1.4rem;">✨</span>
                  <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--pm-text-primary); margin: 0;">AI 影像魔法</h3>
                </div>
                <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem; color: var(--pm-text-secondary);">
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>AI 3mm 出血外擴延伸</strong>：防裁切切頭</span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>髮絲級 AI 精準去背</strong>：透明貼紙專用</span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>AI 點陣轉真向量 SVG</strong>：三次貝茲曲線擬合</span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>K100 純黑文字覆蓋</strong>：文字不糊邊</span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>AI 錯字與亂碼檢查</strong>：智能校正</span></li>
                </ul>
              </div>
              <div style="margin-top: 18px; padding-top: 12px; border-top: 1px solid rgba(0, 113, 227, 0.1); font-size: 0.74rem; color: #0071e3; font-weight: 600;">
                🎁 測試版免費無限制使用
              </div>
            </div>

            <!-- Column 2: Professional Prepress -->
            <div style="background: rgba(88, 86, 214, 0.04); border: 1.5px solid rgba(88, 86, 214, 0.2); border-radius: 16px; padding: 22px 18px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                  <span style="font-size: 1.4rem;">🎛️</span>
                  <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--pm-text-primary); margin: 0;">專業製版與工藝</h3>
                </div>
                <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem; color: var(--pm-text-secondary);">
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>專家級管線開關自訂</strong>：自由調控</span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>雙面合版製版關聯</strong>：名片/明信片</span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>造型刀模 + 0.2mm 內縮白墨</strong>：防溢白</span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>A4/A3 智慧拼模試算</strong>：現省 80% 費用</span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>3D 燙金與局部光物理渲染</strong></span></li>
                </ul>
              </div>
              <div style="margin-top: 18px; padding-top: 12px; border-top: 1px solid rgba(88, 86, 214, 0.1); font-size: 0.74rem; color: #5856d6; font-weight: 600;">
                🎁 測試版免費無限制使用
              </div>
            </div>

            <!-- Column 3: Standards & Fast Delivery -->
            <div style="background: rgba(52, 199, 89, 0.04); border: 1.5px solid rgba(52, 199, 89, 0.2); border-radius: 16px; padding: 22px 18px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                  <span style="font-size: 1.4rem;">🏭</span>
                  <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--pm-text-primary); margin: 0;">出機規範與立印</h3>
                </div>
                <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem; color: var(--pm-text-secondary);">
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>ISO 15930 PDF/X-1a 工業出機檔</strong></span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>國際 ICC 描述檔 (Japan Color / FOGRA)</strong></span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>7-11 ibon / 全家超商 30 秒雲端立印</strong></span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>專業 ISO 印刷規範與送印規格表</strong></span></li>
                  <li style="display: flex; gap: 8px;"><span style="color: #34c759; font-weight: 700;">✓</span><span><strong>100% 離線免連網極速模式</strong></span></li>
                </ul>
              </div>
              <div style="margin-top: 18px; padding-top: 12px; border-top: 1px solid rgba(52, 199, 89, 0.1); font-size: 0.74rem; color: #248a3d; font-weight: 600;">
                🎁 測試版免費無限制使用
              </div>
            </div>
          </div>

          <!-- Bottom Notice Box -->
          <div style="margin-top: 20px; padding: 14px 18px; background: rgba(0, 0, 0, 0.025); border: 1px solid var(--pm-border-subtle); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div style="font-size: 0.82rem; color: var(--pm-text-secondary);">
              💡 <strong>創作者專屬</strong>：您目前享有測試版完整的印刷準備功能。歡迎盡情使用並向我們反饋建議！
            </div>
            <button class="pm-btn pm-btn-primary pm-btn-sm" id="btnStartUsingFree" style="flex-shrink: 0; padding: 6px 16px;">
              開始使用 ➔
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const close = () => this.close();
    this.modalEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (
        target.id === 'btnClosePricing' ||
        target.id === 'pricingBackdrop' ||
        target.id === 'btnStartUsingFree'
      ) {
        close();
      }
    });
  }

  public open(): void {
    this.render();
    this.modalEl.style.display = 'flex';
    SoundEffects.sliderTick();
  }

  public close(): void {
    this.modalEl.style.display = 'none';
  }
}
