/**
 * ICC Profile Reference Data
 *
 * These are publicly documented parameters (name, TAC limit) of real, named industry printing
 * standards, used for TAC limit-checking — that part is real. But there are no actual `.icc`/
 * `.icm` profile files anywhere in this repo, and no color-management library dependency, so this
 * service cannot and does not perform real ICC-based color conversion or gamut mapping. A
 * previous version of this file also had a `cmykMatrix` field per profile with fabricated,
 * suspiciously-similar near-identity numbers that were never read anywhere else in the codebase —
 * decorative fake precision. Removed rather than kept as unused decoration.
 *
 * ⚠️ 2026-08-29 修正一個真實存在的不一致：這裡原本獨立維護了另外 4 個「業界標準」（id：
 * japan-color-2001／fogra-39／us-swop-v2／pso-coated-v3），跟使用者在介面上實際會看到、
 * 能夠選擇的 `src/core/icc-profiles.ts`（4 個 id：japan-color-2001-coated／
 * iso-coated-v2-fogra39／gracol-2006-coated／japan-color-2001-uncoated）幾乎完全對不上——
 * 只有「Japan Color 2001（塗布）」剛好同為 350% 而巧合一致，其餘 3 筆連對應的標準名稱都不同
 * （FOGRA39 這裡原本寫 330%、前端寫 300%；其餘兩筆更是完全不同的標準）。目前 `CloudClient.
 * exportPdfx()`／`getIccProfiles()`（進而是這裡）在正式介面上沒有任何按鈕會呼叫到，屬於尚未
 * 串接的功能，所以還沒有造成使用者能感知到的錯誤結果；但一旦哪天真的串上「送印前 PDF/X-1a
 * 雲端合規檢查」，伺服器端驗證的必須是使用者「實際選擇」的那個設定檔，而不是另一份使用者從未
 * 看過、選不到的清單。改成直接對齊前端這 4 個 id／數字，作為唯一的權威來源。
 */

export interface IccProfileMetadata {
  id: string;
  name: string;
  region: string;
  standard: string;
  maxTac: number; // Maximum Total Area Coverage (%)
  description: string;
}

export const SUPPORTED_ICC_PROFILES: IccProfileMetadata[] = [
  {
    id: 'japan-color-2001-coated',
    name: 'Japan Color 2001 Coated',
    region: '台灣 / 日本 合版印刷標準 (健豪、卡之屋推薦)',
    standard: 'ISO 12647-2:2001',
    maxTac: 350,
    description: '台灣合版印刷界最普遍採用之色彩標準，顯色鮮豔飽和，適用高彩度商業印件。'
  },
  {
    id: 'iso-coated-v2-fogra39',
    name: 'ISO Coated v2 (ECI) / FOGRA39',
    region: '歐洲商業印刷與精裝藝術畫冊規範',
    standard: 'ISO 12647-2:2004',
    maxTac: 300,
    description: '歐洲 ISO 12647-2 國際印刷標準，嚴格限制總墨量 ≤300%，階調平衡平穩細緻。'
  },
  {
    id: 'gracol-2006-coated',
    name: 'GRACoL 2006 Coated1v2',
    region: '北美商業平版印刷標準 (IDEAlliance G7 校正)',
    standard: 'IDEAlliance GRACoL2006_Coated1v2',
    maxTac: 320,
    description: '美洲外銷印件通用之 G7 灰色平衡印刷標準，階調高反差、色彩亮麗。'
  },
  {
    id: 'japan-color-2001-uncoated',
    name: 'Japan Color 2001 Uncoated',
    region: '非塗布紙 / 吸墨紙專用標準',
    standard: 'ISO 12647-2:2001 (Uncoated)',
    maxTac: 260,
    description: '針對吸墨量大、無塗布之美術紙設計，網點擴大率補償達 22%，防止深色死黑黏結。'
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
