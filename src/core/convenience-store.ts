/**
 * Taiwan Convenience Store Print-Ready File Generator (7-ELEVEN ibon & 全家 FamiPort)
 *
 * What this does: generates a correctly-sized, correctly-margined 300 DPI JPEG for each store's
 * paper spec, and links to the store's real official upload website (ibon.com.tw /
 * famiport.family.com.tw). Both of those are real.
 *
 * What this does NOT do: submit an order to 7-11/FamiPort, or generate a real pickup code. An
 * earlier version of this file also had `generateCloudOrder()` / `generateSimulatedQrCode()`,
 * which fabricated an 8-digit pickup PIN and drew a QR-code-shaped image from `Math.random()` —
 * neither was ever submitted to any 7-11/FamiPort system, and the QR was not a real, decodable QR
 * code (no error correction, no valid encoding) even if scanned. A user acting on that fake PIN/QR
 * at a real store would have gotten nothing. Removed rather than kept as a convincing-looking
 * placeholder — this app has no access to 7-11/FamiPort's order APIs, so it can't offer that
 * feature honestly. Getting a real pickup code requires using the store's own website/app, which
 * the "official upload page" link below does.
 */

export interface ConveniencePrintSpec {
  id: string;
  store: '7-11' | 'familymart';
  storeName: string;
  paperType: string;
  widthMm: number;
  heightMm: number;
  widthPx300Dpi: number;
  heightPx300Dpi: number;
  priceNTD: number;
  nonPrintableMarginMm: number;
  description: string;
  recommendedFor: string;
  uploadUrl: string;
}

export const CONVENIENCE_STORE_SPECS: ConveniencePrintSpec[] = [
  {
    id: '711-photo-4x6',
    store: '7-11',
    storeName: '7-ELEVEN ibon',
    paperType: '4×6 專用全彩相片紙',
    widthMm: 100,
    heightMm: 148,
    widthPx300Dpi: 1181,
    heightPx300Dpi: 1748,
    priceNTD: 6,
    nonPrintableMarginMm: 2,
    description: '日本進口高磅數相紙，光澤亮麗，不易褪色。適合明信片、照片、卡片。',
    recommendedFor: '個人收藏、同人明信片、拍立得風格卡片',
    uploadUrl: 'https://www.ibon.com.tw/print_browse.aspx'
  },
  {
    id: '711-a4-special',
    store: '7-11',
    storeName: '7-ELEVEN ibon',
    paperType: 'A4 彩色特殊用紙 (160g 雪銅紙)',
    widthMm: 210,
    heightMm: 297,
    widthPx300Dpi: 2480,
    heightPx300Dpi: 3508,
    priceNTD: 15,
    nonPrintableMarginMm: 4,
    description: '160g 厚磅雪銅紙，紙面平滑微霧，顯色細膩，厚度適中不軟塌。',
    recommendedFor: '插畫海報、作品集封面、展覽小海報',
    uploadUrl: 'https://www.ibon.com.tw/print_browse.aspx'
  },
  {
    id: '711-a4-normal',
    store: '7-11',
    storeName: '7-ELEVEN ibon',
    paperType: 'A4 彩色一般紙 (70g 影印紙)',
    widthMm: 210,
    heightMm: 297,
    widthPx300Dpi: 2480,
    heightPx300Dpi: 3508,
    priceNTD: 10,
    nonPrintableMarginMm: 5,
    description: '標準 70g 影印紙全彩輸出，經濟實惠。',
    recommendedFor: '初稿試印、文件、傳單草稿',
    uploadUrl: 'https://www.ibon.com.tw/print_browse.aspx'
  },
  {
    id: 'fami-sticker-4x6',
    store: 'familymart',
    storeName: '全家 FamiPort',
    paperType: '4×6 寫真相片貼紙',
    widthMm: 100,
    heightMm: 148,
    widthPx300Dpi: 1181,
    heightPx300Dpi: 1748,
    priceNTD: 20,
    nonPrintableMarginMm: 2,
    description: '背膠撕開即可黏貼的相片貼紙，色彩鮮明，抗刮耐磨。',
    recommendedFor: '手帳裝飾、行李箱貼紙、同人模切貼紙',
    uploadUrl: 'https://famiport.family.com.tw/'
  },
  {
    id: 'fami-photo-4x6',
    store: 'familymart',
    storeName: '全家 FamiPort',
    paperType: '4×6 寫真相片紙',
    widthMm: 100,
    heightMm: 148,
    widthPx300Dpi: 1181,
    heightPx300Dpi: 1748,
    priceNTD: 6,
    nonPrintableMarginMm: 2,
    description: '高畫質亮面寫真相紙，隨印隨拿。',
    recommendedFor: '紀念明信片、拍立得照片',
    uploadUrl: 'https://famiport.family.com.tw/'
  },
  {
    id: 'fami-a4-special',
    store: 'familymart',
    storeName: '全家 FamiPort',
    paperType: 'A4 彩色特殊用紙 (160g)',
    widthMm: 210,
    heightMm: 297,
    widthPx300Dpi: 2480,
    heightPx300Dpi: 3508,
    priceNTD: 15,
    nonPrintableMarginMm: 4,
    description: '高磅數厚卡紙彩色輸出，紙質挺拔，質感絕佳。',
    recommendedFor: '個人畫作輸出、精緻 A4 海報',
    uploadUrl: 'https://famiport.family.com.tw/'
  }
];

export class ConvenienceStoreEngine {
  /**
   * Generates a 300 DPI printer-ready image canvas tailored for convenience store printing
   */
  public static async generatePrintReadyCanvas(
    sourceImageData: ImageData,
    spec: ConveniencePrintSpec
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = spec.widthPx300Dpi;
    canvas.height = spec.heightPx300Dpi;
    const ctx = canvas.getContext('2d')!;

    // 1. Pure White Sheet Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Hardware Non-printable Safety Margin Padding in pixels
    const marginPx = Math.round((spec.nonPrintableMarginMm / 25.4) * 300);
    const printableW = canvas.width - marginPx * 2;
    const printableH = canvas.height - marginPx * 2;

    // 3. Draw source image into temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceImageData.width;
    tempCanvas.height = sourceImageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(sourceImageData, 0, 0);

    // 4. Calculate cover/contain scaling to preserve aspect ratio
    const srcAspect = sourceImageData.width / sourceImageData.height;
    const targetAspect = printableW / printableH;

    let drawW: number;
    let drawH: number;
    let drawX: number;
    let drawY: number;

    if (srcAspect > targetAspect) {
      // Source is wider -> fit by width
      drawW = printableW;
      drawH = printableW / srcAspect;
      drawX = marginPx;
      drawY = marginPx + (printableH - drawH) / 2;
    } else {
      // Source is taller -> fit by height
      drawH = printableH;
      drawW = printableH * srcAspect;
      drawY = marginPx;
      drawX = marginPx + (printableW - drawW) / 2;
    }

    // High Quality Smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);

    return canvas;
  }

  /**
   * Generates a download blob (JPEG 98% quality, standard for ibon/FamiPort)
   */
  public static async generatePrintBlob(
    sourceImageData: ImageData,
    spec: ConveniencePrintSpec
  ): Promise<Blob> {
    const canvas = await this.generatePrintReadyCanvas(sourceImageData, spec);
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob!);
        },
        'image/jpeg',
        0.98
      );
    });
  }

}
