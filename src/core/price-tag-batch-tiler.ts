/**
 * 19. 🏷️ Price-Tag-Batch-Tiler Market Price Tag Batch Generator & A4 Sticker Sheet Tiler (MIT)
 * 
 * Pre-Press Problem Solved:
 * Flea market, pop-up store, and craft booth sellers need to print 50+ customized price tags ($50, $100, $250, SALE)
 * onto standard A4 multi-label sticker sheets without wasting time on repetitive manual layout.
 * 
 * Solution:
 * Takes product pricing lists and auto-tiles clean, formatted vector price stickers across an A4 sticker sheet.
 */

export interface PriceTagItem {
  productName: string;
  priceNtd: number;
  originalPriceNtd?: number;
}

export class PriceTagBatchTiler {
  /**
   * Generates A4 sheet layout for batch price tag printing
   */
  public static tilePriceTags(
    items: PriceTagItem[],
    cols: number = 3,
    rows: number = 7
  ): string {
    const totalSlots = cols * rows;
    const tagList = items.slice(0, totalSlots);

    const tagsSvg = tagList.map((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = col * 70 + 5;
      const y = row * 40 + 5;

      return `<g transform="translate(${x}, ${y})">
  <rect width="65" height="36" rx="4" fill="#FFFFFF" stroke="#000000" stroke-width="0.75" />
  <text x="32" y="14" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#000000">${item.productName}</text>
  <text x="32" y="28" font-family="sans-serif" font-weight="bold" font-size="12" text-anchor="middle" fill="#FF0000">NT$ ${item.priceNtd}</text>
</g>`;
    }).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="297" viewBox="0 0 210 297">
  <!-- A4 Price Tag Sheet -->
  ${tagsSvg}
</svg>`;
  }
}
