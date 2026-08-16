import { SoundEffects } from './sound-effects';
import { Toast } from '../ui/toast';

export type FoilEffectType = 'none' | 'gold' | 'rose-gold' | 'silver' | 'spot-uv' | 'holographic';

export interface FoilCraftOption {
  type: FoilEffectType;
  nameZh: string;
  tagZh: string;
  description: string;
}

export const FOIL_CRAFT_OPTIONS: FoilCraftOption[] = [
  { type: 'none', nameZh: '無特殊工藝', tagZh: '標準印刷', description: '標準四色 CMYK 印刷' },
  { type: 'gold', nameZh: '✨ 經典亮金', tagZh: '奢華燙金', description: '傳統高貴金箔熱燙，金屬光澤強烈耀眼' },
  { type: 'rose-gold', nameZh: '🌸 奢華玫瑰金', tagZh: '高雅粉金', description: '溫潤粉金光澤，極致優雅名媛質感' },
  { type: 'silver', nameZh: '⚡ 冷冽亮銀', tagZh: '科技燙銀', description: '鏡面未來銀箔，清晰洗鍊' },
  { type: 'spot-uv', nameZh: '💎 局部立體亮光 (Spot UV)', tagZh: '水晶凸字', description: '透明立體水晶上光，觸感凸起、光澤晶瑩' },
  { type: 'holographic', nameZh: '🌈 雷射七彩炫光', tagZh: '彩虹全息', description: '隨視角變換七彩光譜，現代潮流感十足' }
];

export class FoilSimulator {
  private stageEl: HTMLElement;
  private canvasSheetEl: HTMLElement;
  private overlayEl: HTMLElement;
  private currentFoil: FoilEffectType = 'none';

  constructor(stageContainerId: string, canvasSheetId: string) {
    const stage = document.getElementById(stageContainerId);
    const sheet = document.getElementById(canvasSheetId);
    if (!stage || !sheet) throw new Error('Stage or CanvasSheet element not found for FoilSimulator');

    this.stageEl = stage;
    this.canvasSheetEl = sheet;

    // Create Foil Overlay element
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'pm-foil-overlay';
    this.overlayEl.style.display = 'none';
    this.canvasSheetEl.appendChild(this.overlayEl);

    this.bindPhysicsListeners();
  }

  public setFoil(type: FoilEffectType): void {
    this.currentFoil = type;
    this.updateOverlayStyle();

    if (type === 'none') {
      this.overlayEl.style.display = 'none';
      this.stageEl.classList.remove('pm-has-foil');
    } else {
      this.overlayEl.style.display = 'block';
      this.stageEl.classList.add('pm-has-foil');
      SoundEffects.shutterClick();

      const option = FOIL_CRAFT_OPTIONS.find((o) => o.type === type);
      if (option) {
        Toast.info(`✨ 已套用【${option.nameZh}】工藝模擬 (移動滑鼠或傾斜手機可體驗光影流動)`);
      }
    }
  }

  public getCurrentFoil(): FoilEffectType {
    return this.currentFoil;
  }

  private updateOverlayStyle(): void {
    this.overlayEl.className = `pm-foil-overlay pm-foil-${this.currentFoil}`;
  }

  private bindPhysicsListeners(): void {
    // 1. Desktop: Mouse Tracking
    this.stageEl.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.currentFoil === 'none') return;
      const rect = this.canvasSheetEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      this.updateLighting(x, y);
    });

    // 2. Mobile: Device Orientation (Gyroscope)
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener(
        'deviceorientation',
        (e: DeviceOrientationEvent) => {
          if (this.currentFoil === 'none') return;
          if (e.gamma !== null && e.beta !== null) {
            // Gamma: left to right (-90 to 90)
            // Beta: front to back (-180 to 180)
            const normX = Math.max(0, Math.min(1, (e.gamma + 45) / 90));
            const normY = Math.max(0, Math.min(1, (e.beta - 20) / 70));
            this.updateLighting(normX, normY);
          }
        },
        true
      );
    }
  }

  private updateLighting(normX: number, normY: number): void {
    const angle = Math.round(Math.atan2(normY - 0.5, normX - 0.5) * (180 / Math.PI) + 90);
    const posX = Math.round(normX * 100);
    const posY = Math.round(normY * 100);

    this.canvasSheetEl.style.setProperty('--foil-angle', `${angle}deg`);
    this.canvasSheetEl.style.setProperty('--foil-light-x', `${posX}%`);
    this.canvasSheetEl.style.setProperty('--foil-light-y', `${posY}%`);
  }
}
