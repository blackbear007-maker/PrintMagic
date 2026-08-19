/**
 * Built-in Sample AI Artworks Generator (100% Offline & Instant)
 * Generates authentic 72 DPI web-resolution AI artworks with realistic pre-press challenges:
 * - Low resolution (72~150 DPI needing 4x/8x super-resolution)
 * - Deep shadow overflow (TAC >340% needing ink limiting)
 * - Soft edge definition (needing pre-press USM sharpening)
 */
export class SampleArtworks {
  /**
   * Generates a sample File & DataURL based on type
   */
  public static async loadSample(type: 'anime' | 'cyberpunk' | 'card'): Promise<File> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    if (type === 'anime') {
      // Realistic Midjourney web export: 300x300 px (Low-Res 72~150 DPI)
      canvas.width = 300;
      canvas.height = 300;

      // Soft Pastel Gradient Background
      const bgGrad = ctx.createRadialGradient(150, 150, 30, 150, 150, 190);
      bgGrad.addColorStop(0, '#fff5f7');
      bgGrad.addColorStop(0.5, '#fde2e4');
      bgGrad.addColorStop(1, '#fad2e1');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 300, 300);

      // Cute character shape with rich magenta/black ink
      ctx.fillStyle = '#ff3366';
      ctx.beginPath();
      ctx.arc(150, 140, 80, 0, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = '#fff0f3';
      ctx.beginPath();
      ctx.arc(150, 145, 68, 0, Math.PI * 2);
      ctx.fill();

      // Deep Black Eyes (TAC > 340%)
      ctx.fillStyle = '#050005';
      ctx.beginPath();
      ctx.arc(122, 140, 10, 0, Math.PI * 2);
      ctx.arc(178, 140, 10, 0, Math.PI * 2);
      ctx.fill();

      // Eye Sparkles
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(119, 137, 3.5, 0, Math.PI * 2);
      ctx.arc(175, 137, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Cheeks
      ctx.fillStyle = 'rgba(255, 50, 100, 0.55)';
      ctx.beginPath();
      ctx.arc(110, 156, 11, 0, Math.PI * 2);
      ctx.arc(190, 156, 11, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = '#050005';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(150, 156, 12, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();

      // Decors
      ctx.fillStyle = '#ff9900';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('✨', 65, 80);
      ctx.fillText('⭐', 220, 88);
      ctx.fillText('🌸', 75, 220);
      ctx.fillText('💖', 210, 215);

      // Title (Simulating raw web avatar)
      ctx.fillStyle = '#800f2f';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AI Anime Character Sticker', 150, 260);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#a4133c';
      ctx.fillText('300 × 300 px · 原始 72 DPI 示範', 150, 278);

      return this.canvasToFile(canvas, 'sample-anime-sticker-72dpi.png');
    }

    if (type === 'cyberpunk') {
      // Realistic DALL-E 3 web wallpaper: 600x850 px (~72 DPI on A4 poster)
      canvas.width = 600;
      canvas.height = 850;

      // Heavy Saturated Dark Neon Background (TAC > 360% deep ink)
      const bgGrad = ctx.createLinearGradient(0, 0, 600, 850);
      bgGrad.addColorStop(0, '#000000');
      bgGrad.addColorStop(0.3, '#100018');
      bgGrad.addColorStop(0.7, '#1f0028');
      bgGrad.addColorStop(1, '#000000');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 600, 850);

      // Perspective Grid Lines
      ctx.strokeStyle = 'rgba(0, 255, 230, 0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 600; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 550);
        ctx.lineTo(300 + (i - 300) * 3, 850);
        ctx.stroke();
      }
      for (let y = 550; y <= 850; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(600, y);
        ctx.stroke();
      }

      // Cyberpunk Moon with intense glow
      const moonGrad = ctx.createLinearGradient(300, 150, 300, 450);
      moonGrad.addColorStop(0, '#ff0066');
      moonGrad.addColorStop(1, '#6600cc');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(300, 300, 130, 0, Math.PI * 2);
      ctx.fill();

      // Neon Skyline Silhouettes (Heavy ink area)
      ctx.fillStyle = '#020005';
      ctx.fillRect(100, 380, 70, 200);
      ctx.fillRect(190, 340, 90, 240);
      ctx.fillRect(300, 360, 80, 220);
      ctx.fillRect(400, 390, 100, 190);

      // Glowing Neon Accents
      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 12;
      ctx.fillText('NEON TOKYO 2099', 300, 160);

      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff007f';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('CYBERPUNK ART EXHIBITION POSTER', 300, 200);

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '13px sans-serif';
      ctx.fillText('A4 海報示範 · 600 × 850 px · 原始 72 DPI (需 4x 放大)', 300, 780);

      return this.canvasToFile(canvas, 'sample-cyberpunk-poster-72dpi.png');
    }

    // Business Card: 380x228 px (Low-Res 107 DPI instead of 300 DPI)
    canvas.width = 380;
    canvas.height = 228;

    // Elegant Light Canvas
    ctx.fillStyle = '#fafafc';
    ctx.fillRect(0, 0, 380, 228);

    // Color Stripe
    const stripeGrad = ctx.createLinearGradient(0, 0, 380, 0);
    stripeGrad.addColorStop(0, '#0071e3');
    stripeGrad.addColorStop(0.5, '#34c759');
    stripeGrad.addColorStop(1, '#ff9500');
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(0, 0, 380, 6);

    // Logo & Title
    ctx.fillStyle = '#1d1d1f';
    ctx.font = '800 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('STUDIO MAGIC', 32, 64);

    ctx.fillStyle = '#0071e3';
    ctx.font = '600 10px sans-serif';
    ctx.fillText('AI CREATIVE & INDUSTRIAL DESIGN', 32, 82);

    ctx.strokeStyle = '#e5e5ea';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 100);
    ctx.lineTo(348, 100);
    ctx.stroke();

    // Contact Details
    ctx.fillStyle = '#1d1d1f';
    ctx.font = '700 13px sans-serif';
    ctx.fillText('Steve C. Wang', 32, 128);

    ctx.fillStyle = '#6e6e73';
    ctx.font = '500 9px sans-serif';
    ctx.fillText('Chief Executive Designer', 32, 144);

    ctx.font = '500 8.5px sans-serif';
    ctx.fillText('✉️ hello@printmagic.ai', 32, 172);
    ctx.fillText('🌐 https://printmagic.studio', 32, 188);

    // QR Box
    ctx.fillStyle = '#f2f2f7';
    ctx.strokeStyle = '#d2d2d7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(285, 120, 65, 65, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1d1d1f';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN CARD', 317, 155);

    return this.canvasToFile(canvas, 'sample-business-card-72dpi.png');
  }

  private static canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const file = new File([blob!], filename, { type: 'image/png' });
        resolve(file);
      }, 'image/png');
    });
  }
}
