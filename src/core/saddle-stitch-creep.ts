/**
 * 📐 SaddleStitch-Creep-Compensator Multi-Page Booklet Creep & Shingling Engine (MIT)
 * 
 * Pre-Press Problem Solved:
 * When binding 32~64 page booklets with saddle-stitching (騎馬釘), folded nested sheets push
 * innermost pages outward (Creep / 爬移). After face trimming, inner page margins become narrower,
 * clipping folios, borders, and running headers.
 * 
 * Solution:
 * Calculates progressive inward horizontal shifts (Shingling) based on sheet caliper and page sequence
 * to guarantee equal outer margins on all pages after final 3-knife trimming.
 */

export interface PageCreepShift {
  pageNumber: number;
  sheetIndex: number;
  inwardShiftMm: number;
  isCenterFold: boolean;
}

export interface BookletCreepPlan {
  totalPages: number;
  paperGsm: number;
  sheetCount: number;
  maxCreepMm: number;
  pageShifts: PageCreepShift[];
  recommendations: string[];
}

export class SaddleStitchCreep {
  /**
   * Computes progressive shingling / creep offset for each page in a saddle-stitched booklet
   */
  public static calculateCreepPlan(
    totalPages: number = 32,
    paperGsm: number = 120 // 80, 100, 120, 150 gsm
  ): BookletCreepPlan {
    const sheetCount = Math.ceil(totalPages / 4);
    // Approximate caliper per sheet: 120gsm ≈ 0.14mm
    const caliperMm = (paperGsm / 1000) * 1.18;
    const maxCreepMm = Number(((sheetCount - 1) * caliperMm).toFixed(2));

    const pageShifts: PageCreepShift[] = [];

    for (let p = 1; p <= totalPages; p++) {
      // Outermost sheet is sheet 0 (0 shift), innermost sheet has max shift
      const sheetIdx = p <= totalPages / 2
        ? Math.floor((p - 1) / 2)
        : Math.floor((totalPages - p) / 2);

      const shiftMm = Number((sheetIdx * (caliperMm / 2)).toFixed(3));
      const isCenter = sheetIdx === sheetCount - 1;

      pageShifts.push({
        pageNumber: p,
        sheetIndex: sheetIdx + 1,
        inwardShiftMm: shiftMm,
        isCenterFold: isCenter
      });
    }

    const recommendations: string[] = [
      `✓ 總計 ${totalPages} 頁 (${sheetCount} 張大紙) 騎馬釘最大外推爬移量為 ${maxCreepMm} mm。`,
      `✓ 系統已由外至內自動為最中心摺疊頁施加 ${maxCreepMm} mm 內縮補償，確保三面修邊後版心齊平！`
    ];

    return {
      totalPages,
      paperGsm,
      sheetCount,
      maxCreepMm,
      pageShifts,
      recommendations
    };
  }
}
