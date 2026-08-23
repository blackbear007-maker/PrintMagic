/**
 * 14. 📏 GripMargin-Checker Press Gripper Margin & Clamp Collision Inspector (MIT)
 * 
 * Pre-Press Problem Solved:
 * Commercial sheetfed offset printing presses (Heidelberg, Komori) require an 8~12mm non-printable
 * gripper margin (咬口) along the leading edge of the sheet to mechanically pull the paper.
 * Artwork placed within the gripper zone gets crushed by metal clamps or left blank.
 * 
 * Solution:
 * Inspects sheet boundaries for ink collisions in the leading 10mm gripper zone and gives
 * visual collision alerts before plate burning.
 */

export interface GripperCheckResult {
  hasGripperCollision: boolean;
  gripperMarginMm: number;
  leadingEdge: 'top' | 'bottom' | 'left' | 'right';
  recommendations: string[];
}

export class GripMarginChecker {
  /**
   * Checks if artwork collides with press mechanical gripper margin
   */
  public static checkGripperMargin(
    srcImageData: ImageData,
    gripperMarginMm: number = 10,
    dpi: number = 300
  ): GripperCheckResult {
    const w = srcImageData.width;
    const src = srcImageData.data;
    const gripperPx = Math.round((gripperMarginMm / 25.4) * dpi);

    let inkInGripper = false;

    // Check top leading edge
    for (let y = 0; y < gripperPx; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const idx = (y * w + x) * 4;
        const lum = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
        if (lum < 240 && src[idx + 3] > 100) {
          inkInGripper = true;
          break;
        }
      }
      if (inkInGripper) break;
    }

    const recommendations: string[] = [];
    if (inkInGripper) {
      recommendations.push(`⚠️ 頂部機台咬口區 (${gripperMarginMm}mm 夾爪區) 偵測到重要圖文，建議向下退讓 10mm 防止機台夾爪壓毀圖形。`);
    } else {
      recommendations.push(`✓ 頂部 ${gripperMarginMm}mm 印刷機咬口安全無衝突。`);
    }

    return {
      hasGripperCollision: inkInGripper,
      gripperMarginMm,
      leadingEdge: 'top',
      recommendations
    };
  }
}
