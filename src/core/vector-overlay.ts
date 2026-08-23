export interface OverlayTextItem {
  id: string;
  text: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  fontSizePx: number;
  fontFamily: string;
  isK100: boolean; // Enforces C0 M0 Y0 K100 (Single-plate black)
  color: string;
  isOverprint: boolean;
}

export interface OverlayLogoItem {
  id: string;
  dataUrl: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export class VectorOverlayEngine {
  private textItems: OverlayTextItem[] = [];
  private logoItems: OverlayLogoItem[] = [];

  public getTextItems(): OverlayTextItem[] {
    return [...this.textItems];
  }

  public getLogoItems(): OverlayLogoItem[] {
    return [...this.logoItems];
  }

  public addText(item: Omit<OverlayTextItem, 'id'>): OverlayTextItem {
    const newItem: OverlayTextItem = {
      ...item,
      id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    };
    this.textItems.push(newItem);
    return newItem;
  }

  public addTextItems(items: Omit<OverlayTextItem, 'id'>[]): OverlayTextItem[] {
    const added: OverlayTextItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const newItem: OverlayTextItem = {
        ...items[i],
        id: `text-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`
      };
      this.textItems.push(newItem);
      added.push(newItem);
    }
    return added;
  }

  public setTextItems(items: OverlayTextItem[]): void {
    this.textItems = [...items];
  }

  public addLogo(item: Omit<OverlayLogoItem, 'id'>): OverlayLogoItem {
    const newItem: OverlayLogoItem = {
      ...item,
      id: `logo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    };
    this.logoItems.push(newItem);
    return newItem;
  }

  public removeText(id: string): void {
    this.textItems = this.textItems.filter((t) => t.id !== id);
  }

  public removeLogo(id: string): void {
    this.logoItems = this.logoItems.filter((l) => l.id !== id);
  }

  public clear(): void {
    this.textItems = [];
    this.logoItems = [];
  }

  /**
   * Renders the vector overlay elements on top of a destination canvas context
   */
  public renderOverlay(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    // 1. Render Logos
    for (const logo of this.logoItems) {
      const img = new Image();
      img.src = logo.dataUrl;
      const x = (logo.xPercent / 100) * canvasW;
      const y = (logo.yPercent / 100) * canvasH;
      const w = (logo.widthPercent / 100) * canvasW;
      const h = (logo.heightPercent / 100) * canvasH;
      ctx.drawImage(img, x, y, w, h);
    }

    // 2. Render Vector Text
    for (const item of this.textItems) {
      ctx.font = `bold ${item.fontSizePx}px ${item.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      if (item.isK100) {
        // Enforce 100% Solid Single-Plate Pure Black
        ctx.fillStyle = '#000000';
      } else {
        ctx.fillStyle = item.color || '#000000';
      }

      const x = (item.xPercent / 100) * canvasW;
      const y = (item.yPercent / 100) * canvasH;

      // Draw sharp vector text
      ctx.fillText(item.text, x, y);
    }
  }
}
