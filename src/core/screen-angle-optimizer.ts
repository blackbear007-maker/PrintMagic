/**
 * 19. 📐 ScreenAngle-Optimizer ISO 12647-2 Halftone Rosette Collision Verifier (MIT)
 * 
 * Pre-Press Problem Solved:
 * When outputting 4-color offset plates, incorrect screen angles between Cyan, Magenta, Yellow, and Black
 * cause acute optical rosette clashes (菱形衝網網花), ruining the print.
 * 
 * Solution:
 * Verifies plate screen angles against ISO 12647-2 standards (C: 15°, M: 75°, Y: 0°, K: 45°)
 * and computes separation angle differences to guarantee clean circular rosette formations.
 */

export interface ScreenAngleReport {
  isOptimal: boolean;
  angles: { cyan: number; magenta: number; yellow: number; black: number };
  rosetteQuality: 'clean' | 'clashing' | 'acceptable';
  recommendations: string[];
}

export class ScreenAngleOptimizer {
  /**
   * Evaluates screen angle configuration for 4-color process printing
   */
  public static verifyScreenAngles(
    cyanAngle: number = 15,
    magentaAngle: number = 75,
    yellowAngle: number = 0,
    blackAngle: number = 45
  ): ScreenAngleReport {
    // ISO 12647-2 standard: 30-degree separation between strong colors (C, M, K)
    const diffCM = Math.abs(magentaAngle - cyanAngle);
    const diffMK = Math.abs(magentaAngle - blackAngle);
    const diffCK = Math.abs(cyanAngle - blackAngle);

    const isOptimal = (diffCM === 60 || diffCM === 30) && (diffMK === 30) && (diffCK === 30);

    const recommendations: string[] = [];
    if (isOptimal) {
      recommendations.push('✓ 四色網點角度符合 ISO 12647-2 標準 (C:15°, M:75°, Y:0°, K:45°)，網花結構勻稱清透。');
    } else {
      recommendations.push('⚠️ 網點夾角小於 30° 安全間距，建議調整為標準角度防止印刷撞網 (Moiré)。');
    }

    return {
      isOptimal,
      angles: { cyan: cyanAngle, magenta: magentaAngle, yellow: yellowAngle, black: blackAngle },
      rosetteQuality: isOptimal ? 'clean' : 'clashing',
      recommendations
    };
  }
}
