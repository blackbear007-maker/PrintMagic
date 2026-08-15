/**
 * Industrial ICC Profile & Color Management Service
 * Supports ISO 12647, Japan Color, and FOGRA commercial printing standards
 */

export interface IccProfileMetadata {
  id: string;
  name: string;
  region: string;
  standard: string;
  maxTac: number; // Maximum Total Area Coverage (%)
  description: string;
  cmykMatrix: {
    c: number[];
    m: number[];
    y: number[];
    k: number[];
  };
}

export const SUPPORTED_ICC_PROFILES: IccProfileMetadata[] = [
  {
    id: 'japan-color-2001',
    name: 'Japan Color 2001 Coated',
    region: '亞洲 / 台灣 / 日本',
    standard: 'ISO 12647-2:2001',
    maxTac: 350,
    description: '亞洲平版印刷最廣泛採用之商業銅版紙標準',
    cmykMatrix: {
      c: [0.98, 0.02, 0.01, 0.0],
      m: [0.01, 0.96, 0.03, 0.0],
      y: [0.00, 0.02, 0.97, 0.0],
      k: [0.02, 0.03, 0.02, 0.98]
    }
  },
  {
    id: 'fogra-39',
    name: 'FOGRA39 (ISO Coated v2)',
    region: '歐洲 / 國際標準',
    standard: 'ISO 12647-2:2004',
    maxTac: 330,
    description: '歐洲高階商業印刷與展覽畫冊通用標準',
    cmykMatrix: {
      c: [0.97, 0.03, 0.01, 0.0],
      m: [0.02, 0.95, 0.04, 0.0],
      y: [0.01, 0.03, 0.96, 0.0],
      k: [0.03, 0.03, 0.02, 0.97]
    }
  },
  {
    id: 'us-swop-v2',
    name: 'U.S. Web Coated (SWOP) v2',
    region: '美洲 / 出版印刷',
    standard: 'SWOP 2006',
    maxTac: 300,
    description: '北美雜誌、商業出版物輪轉印刷標準',
    cmykMatrix: {
      c: [0.96, 0.04, 0.02, 0.0],
      m: [0.03, 0.94, 0.05, 0.0],
      y: [0.01, 0.04, 0.95, 0.0],
      k: [0.04, 0.04, 0.03, 0.96]
    }
  },
  {
    id: 'pso-coated-v3',
    name: 'PSO Coated v3 (FOGRA51)',
    region: '新一代高白紙規範',
    standard: 'ISO 12647-2:2013',
    maxTac: 300,
    description: '含螢光增白劑 (OBA) 頂級特銅紙現代色彩規範',
    cmykMatrix: {
      c: [0.99, 0.02, 0.01, 0.0],
      m: [0.01, 0.97, 0.03, 0.0],
      y: [0.00, 0.01, 0.98, 0.0],
      k: [0.02, 0.02, 0.01, 0.99]
    }
  }
];

export class IccService {
  public static getProfile(id: string): IccProfileMetadata {
    const profile = SUPPORTED_ICC_PROFILES.find((p) => p.id === id);
    return profile || SUPPORTED_ICC_PROFILES[0];
  }

  public static listProfiles(): IccProfileMetadata[] {
    return SUPPORTED_ICC_PROFILES;
  }

  public static validateTacCompliance(maxTac: number, profileId: string): {
    compliant: boolean;
    limit: number;
    delta: number;
    message: string;
  } {
    const profile = this.getProfile(profileId);
    const compliant = maxTac <= profile.maxTac;
    const delta = maxTac - profile.maxTac;

    return {
      compliant,
      limit: profile.maxTac,
      delta: Math.max(0, delta),
      message: compliant
        ? `總墨量 ${maxTac}% 符合 ${profile.name} 規範 (≤${profile.maxTac}%)`
        : `總墨量 ${maxTac}% 超出 ${profile.name} 上限 (+${delta.toFixed(1)}%)，建議啟用墨量壓制`
    };
  }
}
