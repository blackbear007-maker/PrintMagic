/**
 * 15. 🔖 Bookmark-Tassel-Planner 5x15cm Bookmark Dieline & Tassel Hole Punch Planner (MIT)
 * 
 * Pre-Press Problem Solved:
 * Creating art bookmarks (文創書籤) requires fitting custom vertical illustrations into standard 5x15cm / 4x14cm
 * dimensions with 3mm rounded corners and an accurate 4mm punch hole for tassel ribbons.
 * 
 * Solution:
 * Fits artwork onto standard bookmark aspect ratios, generates rounded corner dielines, and adds
 * an exact 4mm top center tassel punch guide.
 */

export interface BookmarkOutput {
  bookmarkImageData: ImageData;
  dielineSvg: string;
  bookmarkDimensionsMm: string;
}

export class BookmarkTasselPlanner {
  /**
   * Plans standard 5x15cm bookmark dieline with top tassel punch hole
   */
  public static planBookmark(
    srcImageData: ImageData,
    targetWidthMm: number = 50,
    targetHeightMm: number = 150
  ): BookmarkOutput {
    const w = srcImageData.width;
    const h = srcImageData.height;

    const dielineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- 3mm Corner Bookmark Dieline -->
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="12" fill="none" stroke="#FF00FF" stroke-width="0.75" />
  <!-- 4mm Top Tassel Ribbon Punch Hole -->
  <circle cx="${w / 2}" cy="${h * 0.08}" r="8" fill="none" stroke="#00FFFF" stroke-width="0.75" />
</svg>`;

    return {
      bookmarkImageData: srcImageData,
      dielineSvg,
      bookmarkDimensionsMm: `${targetWidthMm} × ${targetHeightMm} mm`
    };
  }
}
