export type MockupSceneId = 'gallery' | 'desk' | 'card_hand';

export interface MockupScene {
  id: MockupSceneId;
  name: string;
  desc: string;
  icon: string;
}

export const MOCKUP_SCENES: MockupScene[] = [
  {
    id: 'gallery',
    name: '美術館胡桃木框',
    desc: '現代極簡黑胡桃木框與射燈展牆',
    icon: '🏛️'
  },
  {
    id: 'desk',
    name: '北歐橡木工作室',
    desc: '自然晨光橡木書桌與黃銅文具',
    icon: '☕'
  },
  {
    id: 'card_hand',
    name: '第一人稱持卡視角',
    desc: '厚磅名片手持特寫與大光圈景深',
    icon: '📇'
  }
];

export class MockupRenderer {
  /**
   * Render a high-resolution exportable mockup image (1920 × 1280 px)
   */
  public static async renderScene(
    artImg: HTMLImageElement,
    sceneId: MockupSceneId
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d')!;

    switch (sceneId) {
      case 'gallery':
        this.renderGalleryScene(ctx, artImg, canvas.width, canvas.height);
        break;
      case 'desk':
        this.renderDeskScene(ctx, artImg, canvas.width, canvas.height);
        break;
      case 'card_hand':
        this.renderCardHandScene(ctx, artImg, canvas.width, canvas.height);
        break;
    }

    return canvas.toDataURL('image/png', 0.96);
  }

  private static renderGalleryScene(
    ctx: CanvasRenderingContext2D,
    artImg: HTMLImageElement,
    w: number,
    h: number
  ): void {
    // 1. Gallery Wall (Concrete / warm neutral grey)
    const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
    wallGrad.addColorStop(0, '#e5e7eb');
    wallGrad.addColorStop(1, '#d1d5db');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, h);

    // Wall texture noise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
    for (let i = 0; i < 4000; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }

    // 2. Overhead Gallery Spotlight
    const spotGrad = ctx.createRadialGradient(w / 2, 80, 50, w / 2, 500, 750);
    spotGrad.addColorStop(0, 'rgba(255, 252, 240, 0.45)');
    spotGrad.addColorStop(0.5, 'rgba(255, 252, 240, 0.15)');
    spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, w, h);

    // 3. Artwork & Frame Calculation
    const maxArtW = 820;
    const maxArtH = 820;
    const artAspect = artImg.naturalWidth / artImg.naturalHeight;

    let artW: number;
    let artH: number;
    if (artAspect > 1) {
      artW = maxArtW;
      artH = maxArtW / artAspect;
    } else {
      artH = maxArtH;
      artW = maxArtH * artAspect;
    }

    const matMargin = 50; // Passe-partout margin
    const frameBorder = 24; // Walnut frame thickness

    const outerW = artW + (matMargin + frameBorder) * 2;
    const outerH = artH + (matMargin + frameBorder) * 2;
    const outerX = (w - outerW) / 2;
    const outerY = (h - outerH) / 2 + 30;

    // 4. Frame Drop Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.35)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 28;

    // 5. Walnut Wooden Outer Frame
    ctx.fillStyle = '#1e1b18'; // Deep matte walnut
    ctx.fillRect(outerX, outerY, outerW, outerH);
    ctx.restore();

    // Frame subtle wood bevel highlights
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(outerX, outerY, outerW, outerH);

    // 6. White Passe-Partout (Mat Board)
    const matX = outerX + frameBorder;
    const matY = outerY + frameBorder;
    const matW = artW + matMargin * 2;
    const matH = artH + matMargin * 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fcfbf9'; // Museum archival white mat
    ctx.fillRect(matX, matY, matW, matH);
    ctx.restore();

    // Mat inner bevel shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(matX + matMargin, matY + matMargin, artW, artH);

    // 7. Draw Artwork
    const innerX = matX + matMargin;
    const innerY = matY + matMargin;
    ctx.drawImage(artImg, innerX, innerY, artW, artH);

    // Subtle glass reflection sheen across frame
    const glassSheen = ctx.createLinearGradient(outerX, outerY, outerX + outerW, outerY + outerH);
    glassSheen.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    glassSheen.addColorStop(0.3, 'rgba(255, 255, 255, 0.03)');
    glassSheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    glassSheen.addColorStop(0.8, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = glassSheen;
    ctx.fillRect(matX, matY, matW, matH);
  }

  private static renderDeskScene(
    ctx: CanvasRenderingContext2D,
    artImg: HTMLImageElement,
    w: number,
    h: number
  ): void {
    // 1. Natural Solid Oak Wood Tabletop
    const oakGrad = ctx.createLinearGradient(0, 0, w, h);
    oakGrad.addColorStop(0, '#c89d7c');
    oakGrad.addColorStop(0.5, '#b98c69');
    oakGrad.addColorStop(1, '#a67b57');
    ctx.fillStyle = oakGrad;
    ctx.fillRect(0, 0, w, h);

    // Wood Grain streaks
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let y = 0; y < h; y += 4) {
      if (Math.random() > 0.4) {
        ctx.fillRect(0, y, w, 2);
      }
    }

    // 2. Soft Morning Window Light Projection
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.15, 0);
    ctx.lineTo(w * 0.95, 0);
    ctx.lineTo(w * 0.75, h);
    ctx.lineTo(w * 0.0, h);
    ctx.closePath();
    const sunGrad = ctx.createLinearGradient(w * 0.5, 0, w * 0.4, h);
    sunGrad.addColorStop(0, 'rgba(255, 255, 245, 0.32)');
    sunGrad.addColorStop(1, 'rgba(255, 255, 245, 0.08)');
    ctx.fillStyle = sunGrad;
    ctx.fill();
    ctx.restore();

    // 3. Print / Postcard placement with 3D slant angle
    const targetW = 900;
    const targetH = (targetW / artImg.naturalWidth) * artImg.naturalHeight;
    const posX = (w - targetW) / 2 + 40;
    const posY = (h - targetH) / 2;

    ctx.save();
    ctx.translate(posX + targetW / 2, posY + targetH / 2);
    ctx.rotate(-2 * (Math.PI / 180)); // 2 degree natural casual desk rotation

    // Soft tactile paper drop shadow
    ctx.shadowColor = 'rgba(40, 20, 10, 0.28)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetX = 12;
    ctx.shadowOffsetY = 16;

    // Draw White Card Base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-targetW / 2, -targetH / 2, targetW, targetH);
    ctx.shadowColor = 'transparent';

    // Draw Image
    ctx.drawImage(artImg, -targetW / 2, -targetH / 2, targetW, targetH);

    // Subtle paper edge border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-targetW / 2, -targetH / 2, targetW, targetH);

    ctx.restore();

    // 4. Brass Minimalist Accessory (Pencil / Ruler accent on side)
    ctx.save();
    ctx.translate(180, 680);
    ctx.rotate(-15 * (Math.PI / 180));
    ctx.fillStyle = '#d4af37'; // Brass gold
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 8;
    ctx.fillRect(0, 0, 12, 420); // Brass pen
    ctx.restore();
  }

  private static renderCardHandScene(
    ctx: CanvasRenderingContext2D,
    artImg: HTMLImageElement,
    w: number,
    h: number
  ): void {
    // 1. Studio Bokeh Gradient Background
    const bgGrad = ctx.createRadialGradient(w * 0.7, h * 0.3, 100, w / 2, h / 2, 900);
    bgGrad.addColorStop(0, '#334155');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Bokeh circles
    const bokehColors = ['rgba(96, 165, 250, 0.08)', 'rgba(244, 114, 182, 0.06)', 'rgba(253, 224, 71, 0.05)'];
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      const bx = (i * 137) % w;
      const by = (i * 97) % h;
      const br = 40 + (i % 5) * 30;
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = bokehColors[i % bokehColors.length];
      ctx.fill();
    }

    // 2. Thick Card Stock in Center
    const cardW = 760;
    const cardH = (cardW / artImg.naturalWidth) * artImg.naturalHeight;
    const cardX = (w - cardW) / 2 - 20;
    const cardY = (h - cardH) / 2;

    ctx.save();
    ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
    ctx.rotate(3.5 * (Math.PI / 180));

    // Deep Floating Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 56;
    ctx.shadowOffsetX = 16;
    ctx.shadowOffsetY = 24;

    // Card Core Thickness (Dark Edge)
    ctx.fillStyle = '#111827';
    ctx.fillRect(-cardW / 2 - 2, -cardH / 2 - 2, cardW + 4, cardH + 4);

    // Front Card Surface
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
    ctx.shadowColor = 'transparent';

    // Draw Artwork
    ctx.drawImage(artImg, -cardW / 2, -cardH / 2, cardW, cardH);

    // Specular Light Sweep on Card
    const sweep = ctx.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, cardH / 2);
    sweep.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    sweep.addColorStop(0.4, 'rgba(255, 255, 255, 0.03)');
    sweep.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);

    ctx.restore();
  }
}
