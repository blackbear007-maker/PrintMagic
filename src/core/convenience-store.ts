/**
 * Taiwan Convenience Store Cloud Printing Engine (7-ELEVEN ibon & 全家 FamiPort)
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

export interface ConvenienceCloudOrder {
  orderId: string;
  pickupPin: string; // 8-digit PIN e.g. "8492-3819"
  store: '7-11' | 'familymart';
  storeName: string;
  paperType: string;
  priceNTD: number;
  expireTime: string; // e.g. 72 hours from now formatted
  qrDataUrl: string;
  spec: ConveniencePrintSpec;
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

  /**
   * Generates instant simulated/live cloud print order with 8-digit PIN and QR Code
   */
  public static generateCloudOrder(spec: ConveniencePrintSpec): ConvenienceCloudOrder {
    const random1 = Math.floor(1000 + Math.random() * 9000);
    const random2 = Math.floor(1000 + Math.random() * 9000);
    const pickupPin = `${random1}-${random2}`;
    const orderId = `PM${Date.now().toString().slice(-8)}`;

    const now = new Date();
    now.setHours(now.getHours() + 72); // 72 hours validity
    const expireTime = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} 前`;

    const qrDataUrl = this.generateSimulatedQrCode(pickupPin, spec.store);

    return {
      orderId,
      pickupPin,
      store: spec.store,
      storeName: spec.storeName,
      paperType: spec.paperType,
      priceNTD: spec.priceNTD,
      expireTime,
      qrDataUrl,
      spec
    };
  }

  /**
   * Render high-density visual QR pattern on Canvas
   */
  private static generateSimulatedQrCode(code: string, store: '7-11' | 'familymart'): string {
    if (typeof document === 'undefined') {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }
    const size = 180;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const color = store === '7-11' ? '#007a3d' : '#009045';
    ctx.fillStyle = '#1c1c1e';

    // Outer Position Markers (Top-left, Top-right, Bottom-left)
    const drawMarker = (x: number, y: number) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 42, 42);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 6, y + 6, 30, 30);
      ctx.fillStyle = color;
      ctx.fillRect(x + 12, y + 12, 18, 18);
    };

    drawMarker(12, 12);
    drawMarker(size - 54, 12);
    drawMarker(12, size - 54);

    // Matrix Dots based on pseudo-random hash of code
    ctx.fillStyle = '#1c1c1e';
    const grid = 21;
    const cell = size / grid;

    let seed = 0;
    for (let i = 0; i < code.length; i++) seed = (seed * 31 + code.charCodeAt(i)) & 0xffffffff;

    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        // Skip marker areas
        if ((r < 7 && c < 7) || (r < 7 && c >= grid - 7) || (r >= grid - 7 && c < 7)) continue;

        seed = (seed * 16807) % 2147483647;
        if ((seed % 100) < 48) {
          ctx.fillRect(Math.round(c * cell), Math.round(r * cell), Math.ceil(cell - 0.5), Math.ceil(cell - 0.5));
        }
      }
    }

    return canvas.toDataURL('image/png');
  }
}
