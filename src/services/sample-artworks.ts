/**
 * Built-in Pristine Sample AI Artworks Generator (100% Offline & Instant)
 */
export class SampleArtworks {
  /**
   * Generates a sample File & DataURL based on type
   */
  public static async loadSample(type: 'anime' | 'cyberpunk' | 'card'): Promise<File> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    if (type === 'anime') {
      // 1:1 Square Cute Anime Character Sticker (800x800)
      canvas.width = 800;
      canvas.height = 800;

      // Soft Pastel Gradient Background
      const bgGrad = ctx.createRadialGradient(400, 400, 100, 400, 400, 500);
      bgGrad.addColorStop(0, '#fff5f7');
      bgGrad.addColorStop(0.5, '#fde2e4');
      bgGrad.addColorStop(1, '#fad2e1');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 800, 800);

      // Cute character shape
      ctx.fillStyle = '#ff758f';
      ctx.beginPath();
      ctx.arc(400, 380, 200, 0, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = '#fff0f3';
      ctx.beginPath();
      ctx.arc(400, 390, 170, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#590d22';
      ctx.beginPath();
      ctx.arc(330, 380, 24, 0, Math.PI * 2);
      ctx.arc(470, 380, 24, 0, Math.PI * 2);
      ctx.fill();

      // Eye Sparkles
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(322, 372, 8, 0, Math.PI * 2);
      ctx.arc(462, 372, 8, 0, Math.PI * 2);
      ctx.fill();

      // Cheeks
      ctx.fillStyle = 'rgba(255, 77, 109, 0.4)';
      ctx.beginPath();
      ctx.arc(300, 420, 26, 0, Math.PI * 2);
      ctx.arc(500, 420, 26, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = '#590d22';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(400, 420, 30, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();

      // Star Decors
      ctx.fillStyle = '#ffb703';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('✨', 180, 220);
      ctx.fillText('⭐', 580, 240);
      ctx.fillText('🌸', 200, 580);
      ctx.fillText('💖', 560, 560);

      // Title
      ctx.fillStyle = '#800f2f';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AI Anime Character Sticker', 400, 680);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#a4133c';
      ctx.fillText('800 × 800 px · 模切貼紙示範', 400, 720);

      return this.canvasToFile(canvas, 'sample-anime-sticker.png');
    }

    if (type === 'cyberpunk') {
      // 1:1.414 ISO Aspect Ratio Cyberpunk City Poster (1200x1697)
      canvas.width = 1200;
      canvas.height = 1697;

      // Dark Neon Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 1697);
      bgGrad.addColorStop(0, '#0a0a14');
      bgGrad.addColorStop(0.4, '#1b0a2a');
      bgGrad.addColorStop(0.7, '#2b0938');
      bgGrad.addColorStop(1, '#050510');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 1697);

      // Perspective Grid Lines
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 1200; i += 100) {
        ctx.beginPath();
        ctx.moveTo(i, 1100);
        ctx.lineTo(600 + (i - 600) * 3, 1697);
        ctx.stroke();
      }
      for (let y = 1100; y <= 1697; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1200, y);
        ctx.stroke();
      }

      // Cyberpunk Moon / Sun
      const moonGrad = ctx.createLinearGradient(600, 300, 600, 900);
      moonGrad.addColorStop(0, '#ff007f');
      moonGrad.addColorStop(1, '#7928ca');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(600, 600, 260, 0, Math.PI * 2);
      ctx.fill();

      // Neon Skyline Silhouettes
      ctx.fillStyle = '#0f051d';
      ctx.fillRect(200, 750, 140, 400);
      ctx.fillRect(380, 680, 180, 470);
      ctx.fillRect(600, 720, 160, 430);
      ctx.fillRect(800, 780, 200, 370);

      // Glowing Neon Accents
      ctx.fillStyle = '#00f5d4';
      ctx.font = 'bold 84px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 20;
      ctx.fillText('NEON TOKYO 2099', 600, 320);

      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ff007f';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText('CYBERPUNK ART EXHIBITION POSTER', 600, 400);

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = '26px sans-serif';
      ctx.fillText('A4 經典海報示範 · 1200 × 1697 px · 高飽和防溢墨', 600, 1550);

      return this.canvasToFile(canvas, 'sample-cyberpunk-poster.png');
    }

    // Business Card: 1:1.66 Aspect Ratio (1062x637)
    canvas.width = 1062;
    canvas.height = 637;

    // Elegant Light Minimalist Canvas
    ctx.fillStyle = '#fbfbfd';
    ctx.fillRect(0, 0, 1062, 637);

    // Modern Geometric Stripe
    const stripeGrad = ctx.createLinearGradient(0, 0, 1062, 0);
    stripeGrad.addColorStop(0, '#0071e3');
    stripeGrad.addColorStop(0.5, '#34c759');
    stripeGrad.addColorStop(1, '#ff9500');
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(0, 0, 1062, 14);

    // Gold / Blue Monogram
    ctx.fillStyle = '#1d1d1f';
    ctx.font = '800 64px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('STUDIO MAGIC', 90, 180);

    ctx.fillStyle = '#0071e3';
    ctx.font = '600 24px sans-serif';
    ctx.fillText('AI CREATIVE & INDUSTRIAL DESIGN', 90, 230);

    ctx.strokeStyle = '#e5e5ea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, 280);
    ctx.lineTo(972, 280);
    ctx.stroke();

    // Contact Details
    ctx.fillStyle = '#1d1d1f';
    ctx.font = '700 32px sans-serif';
    ctx.fillText('Steve C. Wang', 90, 360);

    ctx.fillStyle = '#6e6e73';
    ctx.font = '500 22px sans-serif';
    ctx.fillText('Chief Executive Designer', 90, 400);

    ctx.font = '500 20px sans-serif';
    ctx.fillText('✉️ hello@printmagic.ai', 90, 480);
    ctx.fillText('🌐 https://printmagic.studio', 90, 520);
    ctx.fillText('📍 Taipei, Taiwan', 90, 560);

    // QR Code Box Placeholder
    ctx.fillStyle = '#f5f5f7';
    ctx.strokeStyle = '#d2d2d7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(800, 350, 172, 172, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1d1d1f';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN CARD', 886, 435);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#86868b';
    ctx.fillText('90 × 54 mm', 886, 465);

    return this.canvasToFile(canvas, 'sample-business-card.png');
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
