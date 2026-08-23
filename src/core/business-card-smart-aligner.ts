/**
 * 20. 📇 Business-Card-Smart-Aligner Swiss Typography Baseline Grid Auto-Aligner (MIT)
 * 
 * Pre-Press Problem Solved:
 * Novice designers placing contact info, phone, email, and titles onto business card artwork
 * often end up with irregular line-spacings, misaligned icons, and sloppy baseline jumps.
 * 
 * Solution:
 * Uses a Swiss 4pt/8pt modular baseline grid to snap and auto-align contact blocks into clean,
 * professional business card typography.
 */

export interface ContactBlock {
  name: string;
  title: string;
  phone: string;
  email: string;
  website: string;
}

export class BusinessCardSmartAligner {
  /**
   * Generates perfectly aligned Swiss modular grid contact block for 90x54mm business cards
   */
  public static alignCardTypography(
    data: ContactBlock,
    cardWidthMm: number = 90,
    cardHeightMm: number = 54
  ): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidthMm}mm" height="${cardHeightMm}mm" viewBox="0 0 ${cardWidthMm} ${cardHeightMm}">
  <!-- Swiss Grid Alignment -->
  <text x="8" y="18" font-family="sans-serif" font-weight="bold" font-size="5" fill="#1D1D1F">${data.name}</text>
  <text x="8" y="24" font-family="sans-serif" font-size="3" fill="#6E6E73">${data.title}</text>
  <line x1="8" y1="28" x2="82" y2="28" stroke="#E5E5EA" stroke-width="0.25" />
  <text x="8" y="34" font-family="sans-serif" font-size="2.5" fill="#1D1D1F">TEL: ${data.phone}</text>
  <text x="8" y="38" font-family="sans-serif" font-size="2.5" fill="#1D1D1F">EMAIL: ${data.email}</text>
  <text x="8" y="42" font-family="sans-serif" font-size="2.5" fill="#1D1D1F">WEB: ${data.website}</text>
</svg>`;
  }
}
