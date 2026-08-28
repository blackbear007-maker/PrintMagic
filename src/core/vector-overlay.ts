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
   * Renders the vector overlay elements on top of a destination canvas context.
   *
   * ⚠️ 2026-08-28 修正一個真實存在的計算錯誤：舊版是同步函式，`new Image(); img.src = dataUrl;`
   * 之後立刻呼叫 `ctx.drawImage(img, ...)`——設定 `.src` 觸發的是非同步解碼，緊接著同步呼叫
   * `drawImage` 時圖片幾乎必然還沒載入完成，導致 Logo 靜默完全沒畫出來（不會噴錯誤，只是輸出裡
   * 沒有 Logo），沒有任何跡象顯示發生了什麼事。改成非同步函式，用 `img.decode()`（現代瀏覽器標準
   * API，比舊式 onload 事件更可靠）確保每張 Logo 圖片真正解碼完成後才畫。
   */
  public async renderOverlay(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): Promise<void> {
    // 1. Render Logos (loaded first, in parallel, before any drawing starts)
    const loadedLogos = await Promise.all(
      this.logoItems.map(async (logo) => {
        const img = new Image();
        img.src = logo.dataUrl;
        try {
          await img.decode();
        } catch {
          return null; // corrupt/unsupported data URL — skip this logo rather than draw garbage
        }
        return { img, logo };
      })
    );
    for (const loaded of loadedLogos) {
      if (!loaded) continue;
      const { img, logo } = loaded;
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
