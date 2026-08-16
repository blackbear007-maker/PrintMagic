import { jsPDF } from 'jspdf';
import type { PrintPreset } from '../types';

export type ActiveSide = 'front' | 'back';
export type BackTemplateType = 'postcard_standard' | 'business_card_minimal' | 'blank_white';

export interface DoubleSidedState {
  hasBack: boolean;
  activeSide: ActiveSide;
  frontDataUrl: string | null;
  frontImageData: ImageData | null;
  backDataUrl: string | null;
  backImageData: ImageData | null;
}

export class DoubleSidedManager {
  private state: DoubleSidedState = {
    hasBack: false,
    activeSide: 'front',
    frontDataUrl: null,
    frontImageData: null,
    backDataUrl: null,
    backImageData: null
  };

  public getState(): DoubleSidedState {
    return { ...this.state };
  }

  public setActiveSide(side: ActiveSide): void {
    this.state.activeSide = side;
  }

  public setFrontImage(dataUrl: string, imgData: ImageData): void {
    this.state.frontDataUrl = dataUrl;
    this.state.frontImageData = imgData;
  }

  public setBackImage(dataUrl: string, imgData: ImageData): void {
    this.state.backDataUrl = dataUrl;
    this.state.backImageData = imgData;
    this.state.hasBack = true;
  }

  public clearBackImage(): void {
    this.state.backDataUrl = null;
    this.state.backImageData = null;
    this.state.hasBack = false;
    this.state.activeSide = 'front';
  }

  /**
   * Procedurally generates a standard high-res 300 DPI back template
   */
  public static generateBackTemplate(
    type: BackTemplateType,
    preset: PrintPreset
  ): { canvas: HTMLCanvasElement; dataUrl: string; imageData: ImageData } {
    const canvas = document.createElement('canvas');
    const dpi = 300;
    const wMm = preset.widthMm > 0 ? preset.widthMm : 148;
    const hMm = preset.heightMm > 0 ? preset.heightMm : 100;

    canvas.width = Math.round((wMm / 25.4) * dpi);
    canvas.height = Math.round((hMm / 25.4) * dpi);
    const ctx = canvas.getContext('2d')!;

    // 1. Base Paper White
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = true;

    if (type === 'postcard_standard') {
      // Draw 6 Postal Code Red Boxes (郵遞區號六格紅框 - 台灣郵政規範)
      const boxW = 40;
      const boxH = 50;
      const boxGap = 12;
      const startX = 60;
      const startY = 60;

      ctx.strokeStyle = '#e60012';
      ctx.lineWidth = 3;

      for (let i = 0; i < 6; i++) {
        const x = startX + i * (boxW + boxGap) + (i >= 3 ? 16 : 0);
        ctx.strokeRect(x, startY, boxW, boxH);
      }

      // Draw Stamp Area (貼郵票處)
      const stampW = 120;
      const stampH = 150;
      const stampX = canvas.width - stampW - 60;
      const stampY = 60;

      ctx.strokeStyle = '#8e8e93';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(stampX, stampY, stampW, stampH);
      ctx.setLineDash([]);

      ctx.fillStyle = '#8e8e93';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('貼郵票處', stampX + stampW / 2, stampY + stampH / 2 + 8);

      // Center Divider Line
      const midX = canvas.width / 2;
      ctx.strokeStyle = '#c7c7cc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(midX, 160);
      ctx.lineTo(midX, canvas.height - 80);
      ctx.stroke();

      // Right Side Address Lines
      const lineStartX = midX + 60;
      const lineEndX = canvas.width - 60;
      const lineStartY = 300;
      const lineStep = 90;

      ctx.strokeStyle = '#d1d1d6';
      ctx.lineWidth = 2;

      for (let i = 0; i < 4; i++) {
        const y = lineStartY + i * lineStep;
        ctx.beginPath();
        ctx.moveTo(lineStartX, y);
        ctx.lineTo(lineEndX, y);
        ctx.stroke();
      }

      // POST CARD Top Heading
      ctx.fillStyle = '#3a3a3c';
      ctx.font = 'bold 36px serif';
      ctx.textAlign = 'center';
      ctx.fillText('POST CARD', canvas.width / 2, 100);
    } else if (type === 'business_card_minimal') {
      // Minimalist Business Card Back Layout
      ctx.fillStyle = '#1c1c1e';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('COMPANY NAME / BRAND', 80, 140);

      ctx.fillStyle = '#8e8e93';
      ctx.font = '26px sans-serif';
      ctx.fillText('Creative Studio · Digital Printing Solutions', 80, 190);

      // Divider
      ctx.strokeStyle = '#e5e5ea';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(80, 240);
      ctx.lineTo(canvas.width - 80, 240);
      ctx.stroke();

      // Contact Details
      ctx.fillStyle = '#3a3a3c';
      ctx.font = '26px sans-serif';
      ctx.fillText('🌐 https://example.com', 80, 320);
      ctx.fillText('📧 contact@example.com', 80, 380);
      ctx.fillText('📱 +886 912-345-678', 80, 440);

      // QR Code Placement Indicator Box
      const qrSize = 180;
      const qrX = canvas.width - qrSize - 80;
      const qrY = canvas.height - qrSize - 80;
      ctx.strokeStyle = '#d1d1d6';
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#8e8e93';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QR CODE', qrX + qrSize / 2, qrY + qrSize / 2 + 8);
    } else {
      // Blank White with subtle watermark in bleed margin
      ctx.fillStyle = '#aeaeb2';
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('— 背面空白 (Blank Page) —', canvas.width / 2, canvas.height / 2);
    }

    const dataUrl = canvas.toDataURL('image/png');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    return { canvas, dataUrl, imageData };
  }

  /**
   * Generates a 2-Page Standard Double-Sided PDF (Page 1 = Front, Page 2 = Back)
   */
  public static async exportDoubleSidedPdf(
    frontDataUrl: string,
    backDataUrl: string,
    preset: PrintPreset
  ): Promise<Blob> {
    const isPortrait = preset.heightMm >= preset.widthMm;
    const orientation = isPortrait ? 'portrait' : 'landscape';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [preset.widthMm, preset.heightMm]
    });

    // Page 1: Front
    pdf.addImage(frontDataUrl, 'PNG', 0, 0, preset.widthMm, preset.heightMm);

    // Page 2: Back
    pdf.addPage([preset.widthMm, preset.heightMm], orientation);
    pdf.addImage(backDataUrl, 'PNG', 0, 0, preset.widthMm, preset.heightMm);

    return pdf.output('blob');
  }
}
