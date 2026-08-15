import type { PaperType } from '../types';

/**
 * Tactile Physical Paper Material & Lighting Simulator
 */
export class PaperSimulator {
  private container: HTMLElement;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Paper simulator #${containerId} not found`);
    this.container = el;
  }

  public setPaper(paper: PaperType): void {
    // Remove existing paper classes
    this.container.classList.remove(
      'pm-paper-glossy',
      'pm-paper-matte',
      'pm-paper-linen',
      'pm-paper-cotton'
    );

    this.container.classList.add(`pm-paper-${paper}`);
  }
}
