import { SoundEffects } from '../core/sound-effects';

/**
 * ⌨️ 印象魔法 快捷鍵與快捷指引面板 (Apple HIG Keyboard Shortcuts HUD)
 */
export class KeyboardShortcutsModal {
  private modalEl: HTMLElement;

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'keyboardShortcutsModal';
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.render();
    document.body.appendChild(this.modalEl);
    this.bindEvents();
  }

  public render(): void {
    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 600px;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(0, 113, 227, 0.1); color: var(--pm-accent-blue); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
              ⌨️
            </div>
            <div>
              <h3 class="pm-modal-title" style="font-size: 1.15rem; font-weight: 800;">
                快捷鍵指南 (Keyboard Shortcuts)
              </h3>
              <p style="font-size: 0.76rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                使用鍵盤快捷鍵快速掌控所有印前檢驗與畫布工具
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseShortcuts">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 16px 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <!-- Category 1: 畫布與檢視 -->
            <div style="background: rgba(0, 0, 0, 0.02); border: 1px solid var(--pm-border-subtle); border-radius: var(--pm-radius-md); padding: 12px 14px;">
              <h4 style="font-size: 0.78rem; font-weight: 800; color: var(--pm-accent-blue); text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
                <span>👁️</span> 畫布與檢視
              </h4>
              <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.78rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>原圖滑桿對比</span>
                  <kbd class="pm-kbd">C</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>3mm 出血與安全框</span>
                  <kbd class="pm-kbd">S</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>CMYK 軟打樣</span>
                  <kbd class="pm-kbd">P</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>TAC 溢墨熱力圖</span>
                  <kbd class="pm-kbd">H</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>20x 玫瑰網點顯微</span>
                  <kbd class="pm-kbd">L</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>100% 實體/縮放還原</span>
                  <kbd class="pm-kbd">Z</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>翻轉紙張正背面</span>
                  <kbd class="pm-kbd">F</kbd>
                </div>
              </div>
            </div>

            <!-- Category 2: 模式、規格與輸出 -->
            <div style="background: rgba(0, 0, 0, 0.02); border: 1px solid var(--pm-border-subtle); border-radius: var(--pm-radius-md); padding: 12px 14px;">
              <h4 style="font-size: 0.78rem; font-weight: 800; color: #8B7FA8; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
                <span>🚀</span> 模式與輸出
              </h4>
              <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.78rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>簡易 / 進階模式切換</span>
                  <kbd class="pm-kbd">M</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>切換規格 (海報/明信片/貼紙)</span>
                  <div style="display: flex; gap: 2px;">
                    <kbd class="pm-kbd">1</kbd> ~ <kbd class="pm-kbd">6</kbd>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>貼上剪貼簿圖片</span>
                  <kbd class="pm-kbd">Ctrl+V</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>下載標準印刷 PDF</span>
                  <kbd class="pm-kbd">E</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>開啟快捷鍵面板</span>
                  <kbd class="pm-kbd">?</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="pm-modal-footer" style="background: transparent; border-top: none; padding: 0 20px 16px 20px; justify-content: space-between;">
          <span style="font-size: 0.74rem; color: var(--pm-text-muted);">
            💡 提示：在畫布上滾動滑鼠滾輪可自由平移與縮放檢視
          </span>
          <button id="btnGotItShortcuts" class="pm-btn pm-btn-primary" style="padding: 6px 18px;">
            知道了
          </button>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const close = () => {
      this.close();
      SoundEffects.sliderTick();
    };

    this.modalEl.querySelector('#btnCloseShortcuts')?.addEventListener('click', close);
    this.modalEl.querySelector('#btnGotItShortcuts')?.addEventListener('click', close);

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        close();
      }
    });
  }

  public open(): void {
    this.modalEl.style.display = 'flex';
    SoundEffects.cardFlip();
  }

  public close(): void {
    this.modalEl.style.display = 'none';
  }

  public toggle(): void {
    if (this.modalEl.style.display === 'flex') {
      this.close();
    } else {
      this.open();
    }
  }
}
