import { SoundEffects } from '../core/sound-effects';

/**
 * Cinematic Pre-Flight Laser Scanline Animation Controller
 */
export class LaserScanController {
  private container: HTMLElement;
  private scanlineEl: HTMLElement;

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

    this.scanlineEl.style.display = 'block';
    this.scanlineEl.classList.remove('pm-laser-active');

    // Force reflow
    void this.scanlineEl.offsetWidth;

    this.scanlineEl.classList.add('pm-laser-active');

    return new Promise((resolve) => {
      setTimeout(() => {
        this.scanlineEl.classList.remove('pm-laser-active');
        this.scanlineEl.style.display = 'none';
        resolve();
      }, 950);
    });
  }
}
