export type IccProfileId =
  | 'japan-color-2001-coated'
  | 'iso-coated-v2-fogra39'
  | 'gracol-2006-coated'
  | 'japan-color-2001-uncoated';

export interface IccProfileSpec {
  id: IccProfileId;
  name: string;
  regionZh: string;
  paperTypeZh: string;
  maxTac: number; // Maximum Total Area Coverage (%)
  dotGainPercent: number; // 50% dot gain compensation (%)
  descriptionZh: string;
  isDefault: boolean;
}

// maxTac（2026-09-25 對齊）：取自 Adobe 描述檔包附的《Profile Information》各描述檔的 Max. total ink，
// 也就是 /icc/to-cmyk 實際分色用的那 4 個描述檔。以 33³ 色 sRGB 網格實測的最高值都在上限內：
// Coated 345.9%、Uncoated 304.7%、FOGRA39 327.1%、GRACoL 332.9%。舊值（FOGRA39 300、GRACoL 320、
// Uncoated 260）比實際分色低，會讓正常的分色結果看起來「超標」。（該 PDF 的 FOGRA39 欄把 Max K 與
// Max total ink 兩個數字寫反了，330% 是總墨量。）
export const ICC_PROFILE_SPECS: IccProfileSpec[] = [
  {
    id: 'japan-color-2001-coated',
    name: 'Japan Color 2001 Coated',
    regionZh: '台灣 / 日本 合版印刷常用標準',
    paperTypeZh: '超光銅版紙、塗布亮面紙',
    maxTac: 350,
    dotGainPercent: 14,
    descriptionZh: '台灣合版印刷界最普遍採用之色彩標準，顯色鮮豔飽和，適用高彩度商業印件。',
    isDefault: true
  },
  {
    id: 'iso-coated-v2-fogra39',
    name: 'Coated FOGRA39 (ISO 12647-2:2004)',
    regionZh: '歐洲商業印刷與精裝藝術畫冊規範',
    paperTypeZh: '歐洲進口雪銅紙、頂級啞粉紙',
    maxTac: 330,
    dotGainPercent: 13,
    descriptionZh: '歐洲 ISO 12647-2 國際印刷標準（FOGRA39），總墨量上限 330%，階調平衡平穩細緻。',
    isDefault: false
  },
  {
    id: 'gracol-2006-coated',
    name: 'Coated GRACoL 2006 (ISO 12647-2:2004)',
    regionZh: '北美商業平版印刷標準 (IDEAlliance G7 校正)',
    paperTypeZh: '北美一級塗布紙 (Grade 1 Premium)',
    maxTac: 340,
    dotGainPercent: 15,
    descriptionZh: '美洲外銷印件通用之 G7 灰色平衡印刷標準，階調高反差、色彩亮麗。',
    isDefault: false
  },
  {
    id: 'japan-color-2001-uncoated',
    name: 'Japan Color 2001 Uncoated',
    regionZh: '非塗布紙 / 吸墨紙專用標準',
    paperTypeZh: '細格萊妮、象牙棉卡、道林紙、模造紙',
    maxTac: 310,
    dotGainPercent: 22,
    descriptionZh: '針對吸墨量大、無塗布之美術紙設計，網點擴大率補償達 22%，防止深色死黑黏結。',
    isDefault: false
  }
];

export class IccProfileEngine {
  private activeProfileId: IccProfileId = 'japan-color-2001-coated';

  public getActiveProfile(): IccProfileSpec {
    return (
      ICC_PROFILE_SPECS.find((p) => p.id === this.activeProfileId) ||
      ICC_PROFILE_SPECS[0]
    );
  }

  public setProfile(id: IccProfileId): void {
    if (ICC_PROFILE_SPECS.some((p) => p.id === id)) {
      this.activeProfileId = id;
    }
  }

  /**
   * Evaluates if total area coverage exceeds the profile's specific TAC limit
   */
  public isTacExceeded(tac: number): boolean {
    const profile = this.getActiveProfile();
    return tac > profile.maxTac;
  }
}

export const iccProfileEngine = new IccProfileEngine();
