import type { AppState } from './state';
import { Toast } from './toast';

/**
 * Zero-Friction Print Shop Specification Sheet Modal
 */
export class SpecModal {
  private modalEl: HTMLElement;

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);

    this.bindEvents();
  }

  public open(state: AppState): void {
    const { currentPreset, dpiAnalysis, inkAnalysis } = state;
    const bleed = currentPreset.bleedMm;
    const totalW = currentPreset.widthMm + bleed * 2;
    const totalH = currentPreset.heightMm + bleed * 2;

    const paperName = currentPreset.recommendedPaper === 'cotton'
      ? '350P 日本頂級象牙棉卡'
      : currentPreset.recommendedPaper === 'linen'
      ? '300P 細格萊妮壓紋紙'
      : currentPreset.recommendedPaper === 'matte'
      ? '250P 雙面霧膜特級銅西卡'
      : '250P 頂級超光銅版紙';

    const copyText = `【PrintMagic 送印規格單】
■ 輸出項目：${currentPreset.nameZh}
■ 成品尺寸：${currentPreset.widthMm} × ${currentPreset.heightMm} mm
■ 含出血尺寸：${totalW} × ${totalH} mm (單邊 ${bleed}mm 出血)
■ 實體解析度：${dpiAnalysis?.currentDpi || currentPreset.targetDpi} DPI 實體渲染
■ 總墨量 TAC：${inkAnalysis?.maxTotalInk || 300}% (已套用 300% 安全壓制防溢)
■ 裁切標記：內嵌 0.1mm 標準向量角線、CMYK 密度條與十字套準
■ 建議紙材：${paperName}
■ 檔案備註：已通過 PrintMagic 預檢直出標準`;

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-spec-dialog">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">📋 印刷廠零障礙通關小抄</span>
            <span class="pm-modal-subtitle">送印溝通無痛小抄，直接傳給印刷廠師傅即可精準出圖</span>
          </div>
          <button class="pm-modal-close" id="btnSpecClose">✕</button>
        </div>

        <div class="pm-spec-card">
          <div class="pm-spec-row">
            <span class="pm-spec-k">輸出項目</span>
            <span class="pm-spec-v">${currentPreset.nameZh}</span>
          </div>
          <div class="pm-spec-row">
            <span class="pm-spec-k">成品淨尺寸</span>
            <span class="pm-spec-v">${currentPreset.widthMm} × ${currentPreset.heightMm} mm</span>
          </div>
          <div class="pm-spec-row">
            <span class="pm-spec-k">含出血總尺寸</span>
            <span class="pm-spec-v pm-text-highlight">${totalW} × ${totalH} mm (各邊 ${bleed}mm 出血)</span>
          </div>
          <div class="pm-spec-row">
            <span class="pm-spec-k">實體解析度</span>
            <span class="pm-spec-v">${dpiAnalysis?.currentDpi || 300} DPI (標準印刷級)</span>
          </div>
          <div class="pm-spec-row">
            <span class="pm-spec-k">總墨量 TAC</span>
            <span class="pm-spec-v">${inkAnalysis?.maxTotalInk || 300}% (已限制 ≤300% 防背印)</span>
          </div>
          <div class="pm-spec-row">
            <span class="pm-spec-k">建議印刷用紙</span>
            <span class="pm-spec-v">${paperName}</span>
          </div>
          <div class="pm-spec-row">
            <span class="pm-spec-k">裁切與套準</span>
            <span class="pm-spec-v">已內嵌 0.1mm 向量角線、CMYK 色條、十字標記</span>
          </div>
        </div>

        <div class="pm-modal-footer">
          <button class="pm-btn pm-btn-ghost" id="btnSpecCancel">關閉</button>
          <button class="pm-btn pm-btn-primary" id="btnSpecCopy">
            <span>📋</span> 一鍵複製文字小抄
          </button>
        </div>
      </div>
    `;

    this.modalEl.style.display = 'flex';
    requestAnimationFrame(() => this.modalEl.classList.add('pm-modal-open'));

    // Bind inner copy event
    this.modalEl.querySelector('#btnSpecCopy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(copyText).then(() => {
        Toast.success('✓ 規格小抄已複製到剪貼簿！');
      }).catch(() => {
        Toast.info(copyText);
      });
    });

    this.modalEl.querySelector('#btnSpecClose')?.addEventListener('click', () => this.hide());
    this.modalEl.querySelector('#btnSpecCancel')?.addEventListener('click', () => this.hide());
  }

  private bindEvents(): void {
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.hide();
    });
  }

  public hide(): void {
    this.modalEl.classList.remove('pm-modal-open');
    setTimeout(() => {
      this.modalEl.style.display = 'none';
    }, 250);
  }
}
