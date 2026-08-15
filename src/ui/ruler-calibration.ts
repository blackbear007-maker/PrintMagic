import { store } from './state';
import { SoundEffects } from '../core/sound-effects';
import { Toast } from './toast';

/**
 * 1:1 Physical Screen Scale & Credit Card Calibration Modal
 * ISO/IEC 7810 ID-1 Standard Benchmark: 85.60 mm × 53.98 mm
 */
export class RulerCalibrationModal {
  private modalEl: HTMLElement;
  private cardEl!: HTMLElement;
  private sliderEl!: HTMLInputElement;
  private ppiValueEl!: HTMLElement;
  private cardWidthPx = 324; // Default ~96 PPI (85.6mm / 25.4 * 96 ≈ 323.5px)

  public static readonly CARD_WIDTH_MM = 85.60;
  public static readonly CARD_HEIGHT_MM = 53.98;

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.render();
    document.body.appendChild(this.modalEl);

    this.bindEvents();
  }

  private render(): void {
    const currentPpi = store.getState().screenPpi;
    this.cardWidthPx = Math.round((RulerCalibrationModal.CARD_WIDTH_MM / 25.4) * currentPpi);

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-calibration-dialog">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">📏 實體 1:1 螢幕真尺寸校準</span>
            <span class="pm-modal-subtitle">拿一張隨身信用卡/健保卡貼在螢幕上，調整至完全重合即可精確校準螢幕像素密度</span>
          </div>
          <button class="pm-modal-close" id="btnCalibClose">✕</button>
        </div>

        <div class="pm-calib-body">
          <!-- Live Interactive Credit Card Reference -->
          <div class="pm-calib-card-stage">
            <div class="pm-calib-card" id="calibCard" style="width: ${this.cardWidthPx}px;">
              <div class="pm-calib-card-inner">
                <div class="pm-calib-chip"></div>
                <div class="pm-calib-card-brand">STANDARD CARD (85.6 × 54 mm)</div>
                <div class="pm-calib-ruler-marks">
                  <span>|</span><span>|</span><span>|</span><span>|</span><span>|</span><span>|</span><span>|</span><span>|</span>
                </div>
                <div class="pm-calib-hint">💳 請將實體卡片貼在畫面上對齊</div>
              </div>
            </div>
          </div>

          <!-- Slider Controls -->
          <div class="pm-calib-controls">
            <div class="pm-calib-slider-row">
              <span class="pm-calib-slider-label">卡片寬度微調：</span>
              <input type="range" id="calibSlider" min="200" max="600" step="1" value="${this.cardWidthPx}" class="pm-calib-slider" />
              <span class="pm-calib-slider-val" id="calibCardPx">${this.cardWidthPx} px</span>
            </div>

            <!-- Preset Display PPIs -->
            <div class="pm-calib-presets">
              <span style="font-size: 0.8rem; color: var(--pm-text-muted);">快速預設：</span>
              <button class="pm-calib-p-btn" data-ppi="96">24" 1080p (96 PPI)</button>
              <button class="pm-calib-p-btn" data-ppi="109">27" 2K (109 PPI)</button>
              <button class="pm-calib-p-btn" data-ppi="163">27" 4K (163 PPI)</button>
              <button class="pm-calib-p-btn" data-ppi="220">Retina (220 PPI)</button>
            </div>

            <div class="pm-calib-readout">
              當前計算螢幕解析度：<strong id="calibPpiVal" class="pm-text-highlight">${currentPpi.toFixed(1)} PPI</strong>
            </div>
          </div>
        </div>

        <div class="pm-modal-footer">
          <button class="pm-btn pm-btn-ghost" id="btnCalibCancel">取消</button>
          <button class="pm-btn pm-btn-primary" id="btnCalibSave">
            <span>✓</span> 儲存校準並開啟 1:1 檢視
          </button>
        </div>
      </div>
    `;

    this.cardEl = this.modalEl.querySelector('#calibCard')!;
    this.sliderEl = this.modalEl.querySelector('#calibSlider')!;
    this.ppiValueEl = this.modalEl.querySelector('#calibPpiVal')!;
  }

  private bindEvents(): void {
    // Close
    this.modalEl.querySelector('#btnCalibClose')?.addEventListener('click', () => this.hide());
    this.modalEl.querySelector('#btnCalibCancel')?.addEventListener('click', () => this.hide());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.hide();
    });

    // Slider Input
    this.sliderEl.addEventListener('input', () => {
      this.cardWidthPx = parseInt(this.sliderEl.value, 10);
      this.updateCardWidth();
      SoundEffects.sliderTick();
    });

    // Preset Buttons
    this.modalEl.querySelectorAll<HTMLButtonElement>('.pm-calib-p-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ppi = parseFloat(btn.dataset.ppi || '96');
        this.cardWidthPx = Math.round((RulerCalibrationModal.CARD_WIDTH_MM / 25.4) * ppi);
        this.sliderEl.value = String(this.cardWidthPx);
        this.updateCardWidth();
        SoundEffects.sliderTick();
      });
    });

    // Save Button
    this.modalEl.querySelector('#btnCalibSave')?.addEventListener('click', () => {
      const calculatedPpi = (this.cardWidthPx / RulerCalibrationModal.CARD_WIDTH_MM) * 25.4;
      store.setScreenPpi(calculatedPpi);
      if (!store.getState().is1to1Scale) {
        store.toggle1to1Scale();
      }
      SoundEffects.purityChime();
      Toast.success(`✓ 螢幕 PPI 校準已儲存 (${calculatedPpi.toFixed(1)} PPI)，已啟動 1:1 真實尺寸檢視！`);
      this.hide();
    });
  }

  private updateCardWidth(): void {
    const cardPxEl = this.modalEl.querySelector('#calibCardPx');
    if (cardPxEl) cardPxEl.textContent = `${this.cardWidthPx} px`;

    this.cardEl.style.width = `${this.cardWidthPx}px`;

    const ppi = (this.cardWidthPx / RulerCalibrationModal.CARD_WIDTH_MM) * 25.4;
    this.ppiValueEl.textContent = `${ppi.toFixed(1)} PPI`;
  }

  public open(): void {
    const currentPpi = store.getState().screenPpi;
    this.cardWidthPx = Math.round((RulerCalibrationModal.CARD_WIDTH_MM / 25.4) * currentPpi);
    this.sliderEl.value = String(this.cardWidthPx);
    this.updateCardWidth();

    this.modalEl.style.display = 'flex';
    requestAnimationFrame(() => this.modalEl.classList.add('pm-modal-open'));
  }

  public hide(): void {
    this.modalEl.classList.remove('pm-modal-open');
    setTimeout(() => {
      this.modalEl.style.display = 'none';
    }, 250);
  }
}
