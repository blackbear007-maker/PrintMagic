import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';

/**
 * 🛡️ 送印通關護照 (Print-Ready Passport Modal)
 * 解決新手印前最後一哩路恐慌：
 * 1. 複製給印刷廠老闆的一句話
 * 2. 印刷廠問紙材/磅數的標準回答小抄
 * 3. 超商列印檔快速入口
 */
export class PassportModal {
  private modalEl: HTMLElement;

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-overlay';
    this.modalEl.id = 'passportModalOverlay';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);
  }

  public open(): void {
    SoundEffects.purityChime();
    this.render();
    this.modalEl.style.display = 'flex';
  }

  public close(): void {
    this.modalEl.style.display = 'none';
  }

  private render(): void {
    const state = store.getState();
    const preset = state.currentPreset;
    const sizeText = preset.widthMm > 0 ? `${preset.widthMm} × ${preset.heightMm} mm` : '數位規格';
    const refText = preset.realWorldRef || '';

    // Recommended paper answer
    let paperRecommendation = '250P 雙面啞粉 (霧面質感高雅)';
    if (preset.id === 'poster-a4' || preset.id === 'poster-a3') {
      paperRecommendation = '150P 超光銅版 (亮面鮮豔反光佳)';
    } else if (preset.id === 'postcard') {
      paperRecommendation = '300P 細格萊妮 (十字布紋文創手感)';
    } else if (preset.id === 'sticker') {
      paperRecommendation = '銅版上亮膜貼紙 (防潑水耐磨)';
    }

    // 依實際規格組字：出血與 DPI 由預設決定；PDF 內容是 RGB 影像（非向量字、非 CMYK）
    const bleedPart = preset.bleedMm > 0 ? `已做好 ${preset.bleedMm}mm 出血、` : '無出血、';
    const specPhrase = `老闆您好，這是${bleedPart}${preset.targetDpi}DPI 影像的 RGB 印刷 PDF (${preset.nameZh} ${sizeText})，如需 CMYK 請協助轉檔，謝謝！`;

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-overlay-dialog" style="max-width: 520px; border: 1px solid rgba(60, 30, 140, 0.25); box-shadow: 0 20px 48px rgba(0, 0, 0, 0.15);">
        <!-- Header -->
        <div class="pm-modal-header" style="background: linear-gradient(135deg, rgba(60, 30, 140, 0.08) 0%, rgba(52, 199, 89, 0.08) 100%); border-bottom: 1px solid rgba(60, 30, 140, 0.15);">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title" style="display: flex; align-items: center; gap: 8px;">
              <img src="icons/shared/shield.webp" alt="" class="pm-icon-img" /> 送印通關護照 (零退件指南)
            </span>
            <span class="pm-modal-subtitle">PDF 已成功下載！請依照下方小抄安心送印</span>
          </div>
          <button class="pm-modal-close" id="btnPassportClose"><img src="icons/shared/close.webp" alt="" class="pm-icon-img" /></button>
        </div>

        <div class="pm-conv-body" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
          <!-- 1. What to say to print shop owner -->
          <div style="background: rgba(60, 30, 140, 0.04); border: 1px solid rgba(60, 30, 140, 0.18); border-radius: 12px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.84rem; font-weight: 700; color: var(--pm-text-primary); display: flex; align-items: center; gap: 6px;">
                <img src="icons/shared/speech-bubble.webp" alt="" class="pm-icon-img" /> 傳給印刷廠老闆一句話
              </span>
              <button id="btnCopyPassportPhrase" class="pm-btn pm-btn-xs pm-btn-artisan" type="button">
                <img src="icons/shared/clipboard.webp" alt="" class="pm-icon-img" /> 一鍵複製
              </button>
            </div>
            <div style="font-size: 0.8rem; color: var(--pm-text-primary); line-height: 1.45; background: #fff; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.06); user-select: all;">
              ${specPhrase}
            </div>
          </div>

          <!-- 2. Paper Recommendation Cheat-Sheet -->
          <div style="background: rgba(0, 0, 0, 0.02); border: 1px solid rgba(0, 0, 0, 0.06); border-radius: 12px; padding: 12px 14px;">
            <span style="font-size: 0.84rem; font-weight: 700; color: var(--pm-text-primary); display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <img src="icons/shared/tag.webp" alt="" class="pm-icon-img" /> 老闆問你要印什麼紙？
            </span>
            <div style="font-size: 0.8rem; color: var(--pm-text-secondary); line-height: 1.45;">
              建議直接回答：<strong style="color: var(--pm-accent-blue);">${paperRecommendation}</strong>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); margin-top: 2px;">
                實體尺寸：${sizeText} ${refText ? `(${refText})` : ''}
              </div>
            </div>
          </div>

          <!-- 3. 7-11 / FamilyMart Convenience Store Steps -->
          <div style="background: rgba(52, 199, 89, 0.04); border: 1px solid rgba(52, 199, 89, 0.18); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="icons/shared/store.webp" alt="" class="pm-icon-img" />
              <div>
                <div style="font-size: 0.82rem; font-weight: 700; color: var(--pm-text-primary);">超商列印檔</div>
                <div style="font-size: 0.72rem; color: var(--pm-text-secondary);">下載排版好的檔案，至 7-11 ibon / 全家官網上傳即可取得取件碼</div>
              </div>
            </div>
            <button id="btnPassportOpenConv" class="pm-btn pm-btn-xs pm-btn-secondary" type="button">
              查看教學
            </button>
          </div>

          <!-- Dismiss Action -->
          <div style="display: flex; justify-content: flex-end; padding-top: 6px;">
            <button id="btnPassportOk" class="pm-btn pm-btn-primary pm-btn-md" style="width: 100%; font-weight: 700; box-shadow: 0 4px 14px rgba(60, 30, 140, 0.3);">
              <img src="icons/shared/check.webp" alt="" class="pm-icon-img" /> 太棒了，我知道了！
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind events
    this.modalEl.querySelector('#btnPassportClose')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('#btnPassportOk')?.addEventListener('click', () => this.close());

    this.modalEl.querySelector('#btnCopyPassportPhrase')?.addEventListener('click', () => {
      if (navigator.clipboard) {
        void navigator.clipboard.writeText(specPhrase);
        Toast.success('✓ 已複製一句話送印小抄！');
      }
    });

    this.modalEl.querySelector('#btnPassportOpenConv')?.addEventListener('click', () => {
      this.close();
      document.getElementById('btnOpenConvPrint')?.click();
    });
  }
}
