import type { PrintPreset } from '../types';
import { SoundEffects } from '../core/sound-effects';

/**
 * 3D Physics Paper Tilt, Specular Light Sweep & Backside Flip Controller
 */
export class Paper3DController {
  private stageContainer: HTMLElement;
  private canvasSheet: HTMLElement;
  private specularLayer: HTMLElement;
  private isFlipped = false;
  private currentPreset: PrintPreset;

  constructor(stageContainerId: string, canvasSheetId: string, initialPreset: PrintPreset) {
    const stage = document.getElementById(stageContainerId);
    const canvas = document.getElementById(canvasSheetId);
    if (!stage || !canvas) throw new Error('Stage or Canvas Sheet not found');

    this.stageContainer = stage;
    this.canvasSheet = canvas;
    this.currentPreset = initialPreset;

    // Create Specular Sweep Layer
    this.specularLayer = document.createElement('div');
    this.specularLayer.className = 'pm-specular-sweep';
    this.canvasSheet.appendChild(this.specularLayer);

    // Create Backside Sheet Layer
    this.createBackside();
    this.bindTiltEvents();
  }

  public updatePreset(preset: PrintPreset): void {
    this.currentPreset = preset;
    this.updateBacksideContent();
  }

  private createBackside(): void {
    let backside = this.canvasSheet.querySelector('.pm-paper-back') as HTMLElement;
    if (!backside) {
      backside = document.createElement('div');
      backside.className = 'pm-paper-back';
      this.canvasSheet.appendChild(backside);
    }
    this.updateBacksideContent();
  }

  private updateBacksideContent(): void {
    const backside = this.canvasSheet.querySelector('.pm-paper-back');
    if (!backside) return;

    const paperGsm = this.currentPreset.recommendedPaper === 'cotton'
      ? '350 gsm Archival Cotton Card (純棉象牙卡)'
      : this.currentPreset.recommendedPaper === 'linen'
      ? '300 gsm Fine Linen Texture (細格萊妮紙)'
      : this.currentPreset.recommendedPaper === 'matte'
      ? '250 gsm Double-side Matte (雙面啞粉卡)'
      : '250 gsm Super Gloss Art (超光銅版紙)';

    backside.innerHTML = `
      <div class="pm-back-inner">
        <div class="pm-back-watermark">PREVIEW</div>

        <div class="pm-back-header">
          <span class="pm-back-logo">✨ PrintMagic Studio</span>
          <span class="pm-back-tag">紙材預覽</span>
        </div>

        <div class="pm-back-meta-grid">
          <div class="pm-back-item">
            <span class="pm-back-label">SPECIFICATION / 規格</span>
            <span class="pm-back-val">${this.currentPreset.nameZh} (${this.currentPreset.widthMm}×${this.currentPreset.heightMm}mm)</span>
          </div>
          <div class="pm-back-item">
            <span class="pm-back-label">RECOMMENDED STOCK / 建議紙材</span>
            <span class="pm-back-val">${paperGsm}</span>
          </div>
        </div>

        <div class="pm-back-swatches">
          <div class="pm-back-swatch" style="background:#00a8e8" title="Cyan 100%"></div>
          <div class="pm-back-swatch" style="background:#e60067" title="Magenta 100%"></div>
          <div class="pm-back-swatch" style="background:#ffd000" title="Yellow 100%"></div>
          <div class="pm-back-swatch" style="background:#1a1a1a" title="Key 100%"></div>
          <div class="pm-back-swatch" style="background:#f4f4f4; border: 1px solid #ccc" title="Paper White"></div>
        </div>

        <div class="pm-back-footer">
          <span>紙材與尺寸預覽，非印前檢驗證書</span>
          <span>FLIP TO FRONT ↻</span>
        </div>
      </div>
    `;

    backside.addEventListener('click', () => this.flip());
  }

  private bindTiltEvents(): void {
    this.stageContainer.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isFlipped) return;

      const rect = this.canvasSheet.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const normX = (e.clientX - centerX) / (rect.width / 2);
      const normY = (e.clientY - centerY) / (rect.height / 2);

      const tiltX = -normY * 4.5; // Max 4.5 degree rotation
      const tiltY = normX * 4.5;

      this.canvasSheet.style.transform = `perspective(1200px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale(1.006)`;

      // Specular highlight gradient sweep
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      this.specularLayer.style.background = `radial-gradient(circle at ${localX}px ${localY}px, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 35%, transparent 65%)`;
      this.specularLayer.style.opacity = '1';
    });

    this.stageContainer.addEventListener('mouseleave', () => {
      if (!this.isFlipped) {
        this.canvasSheet.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)';
        this.specularLayer.style.opacity = '0';
      }
    });
  }

  public flip(): void {
    this.isFlipped = !this.isFlipped;
    SoundEffects.paperDrop();

    if (this.isFlipped) {
      this.canvasSheet.classList.add('pm-flipped');
      this.canvasSheet.style.transform = 'perspective(1200px) rotateY(180deg)';
      this.specularLayer.style.opacity = '0';
    } else {
      this.canvasSheet.classList.remove('pm-flipped');
      this.canvasSheet.style.transform = 'perspective(1200px) rotateY(0deg)';
    }
  }

  public getIsFlipped(): boolean {
    return this.isFlipped;
  }
}
