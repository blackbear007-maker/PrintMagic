import { SoundEffects } from '../core/sound-effects';

/**
 * Cinematic Pre-Flight Laser Scanline Animation Controller
 */
export class LaserScanController {
  private container: HTMLElement;
  private scanlineEl: HTMLElement;
  private scanTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pendingResolvers: Array<() => void> = [];

  constructor(targetStageId: string) {
    const stage = document.getElementById(targetStageId);
    if (!stage) throw new Error('Stage element for Laser Scan not found');
    this.container = stage;

    this.scanlineEl = document.createElement('div');
    this.scanlineEl.className = 'pm-laser-scanline';
    this.scanlineEl.style.display = 'none';
    this.container.appendChild(this.scanlineEl);
  }

  public async triggerScan(): Promise<void> {
    SoundEffects.laserScan();

    // ⚠️ 2026-08-29 修正：批次處理時，若上一張圖片的處理速度快過掃描動畫的 950ms，
    // 下一張圖片會在動畫播到一半時再次呼叫 triggerScan()，但舊呼叫的 setTimeout 仍然
    // 存在——它會在自己原訂的時間點提前把新動畫關掉，造成閃爍。這裡改成：新呼叫進來時
    // 先取消尚未觸發的舊 timeout，讓動畫從現在重新計時 950ms，並把所有累積中、等待
    // resolve 的呼叫收集起來，等真正的（最新一次）timeout 觸發時一起 resolve，
    // 確保沒有任何一次呼叫的 Promise 永遠不會解決。
    if (this.scanTimeoutId !== null) {
      clearTimeout(this.scanTimeoutId);
      this.scanTimeoutId = null;
    }

    this.scanlineEl.style.display = 'block';
    this.scanlineEl.classList.remove('pm-laser-active');

    // Force reflow
    void this.scanlineEl.offsetWidth;

    this.scanlineEl.classList.add('pm-laser-active');

    return new Promise((resolve) => {
      this.pendingResolvers.push(resolve);
      this.scanTimeoutId = setTimeout(() => {
        this.scanlineEl.classList.remove('pm-laser-active');
        this.scanlineEl.style.display = 'none';
        this.scanTimeoutId = null;
        const resolvers = this.pendingResolvers;
        this.pendingResolvers = [];
        resolvers.forEach((r) => r());
      }, 950);
    });
  }

  /**
   * ✨ Photonic/Deep Fusion style Magic Reveal Glow Sweep
   */
  public async triggerMagicReveal(): Promise<void> {
    SoundEffects.purityChime();
    const revealEl = document.createElement('div');
    revealEl.className = 'pm-magic-reveal pm-magic-reveal-active';
    this.container.appendChild(revealEl);

    setTimeout(() => {
      revealEl.remove();
    }, 700);
  }
}
