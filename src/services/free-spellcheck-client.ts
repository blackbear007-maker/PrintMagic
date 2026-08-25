/**
 * 🔤 Local Print-Industry Typo Dictionary
 *
 * A hardcoded list of ~18 regex find/replace rules for common print-industry and Traditional
 * Chinese typos (CMYK misspellings, DPI misspellings, a handful of common Chinese typos). Genuinely
 * 100% local and offline — that part is real, verified: no fetch/network call anywhere in this
 * file. But "NDA Privacy Shield Compliant" / "certified" below is not a real third-party
 * certification, just this file's own description of itself; and the "0.1ms" timing claim was
 * never measured. There is no Levenshtein fuzzy matching here either — every rule is an exact
 * regex match. (The actual Levenshtein fuzzy dictionary lookup lives in text-inspector.ts.)
 */

export interface SpellCheckMatch {
  message: string;
  offset: number;
  length: number;
  ruleId: string;
  replacements: string[];
  contextText: string;
}

export interface SpellCheckResult {
  hasIssues: boolean;
  matches: SpellCheckMatch[];
  language: string;
  source: 'local' | 'cache';
  endpoint?: string;
}

// ─── LRU Cache (max 200 entries) ──────────────────────────────────────────
class LruCache<K, V> {
  private readonly max: number;
  private readonly map: Map<K, V>;
  constructor(max: number) {
    this.max = max;
    this.map = new Map();
  }
  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.max) {
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, value);
  }
  has(key: K): boolean { return this.map.has(key); }
}

// ─── High-Precision Print & General Typography Dictionary Matrix ───────────
const LOCAL_TYPO_RULES: Array<{ wrong: RegExp; correct: string; msg: string; ruleId: string }> = [
  // Printing & Technical Terminology
  { wrong: /CMKY/gi,  correct: 'CMYK',   msg: '色彩模式名稱拼寫異常，建議改為標準「CMYK」', ruleId: 'PREPRESS_CMYK' },
  { wrong: /CMTK/gi,  correct: 'CMYK',   msg: '色彩模式名稱拼寫異常，建議改為標準「CMYK」', ruleId: 'PREPRESS_CMYK' },
  { wrong: /CYMK/gi,  correct: 'CMYK',   msg: '色彩模式名稱拼寫異常，建議改為標準「CMYK」', ruleId: 'PREPRESS_CMYK' },
  { wrong: /\bdip\b/gi, correct: 'DPI',   msg: '解析度單位拼寫異常，建議改為標準大寫「DPI」', ruleId: 'PREPRESS_DPI' },
  { wrong: /\bpdi\b/gi, correct: 'DPI',   msg: '解析度單位拼寫異常，建議改為標準大寫「DPI」', ruleId: 'PREPRESS_DPI' },
  { wrong: /解晰度/g,  correct: '解析度', msg: '「解晰度」為常見錯別字，應為「解析度」', ruleId: 'TYPO_ZH_DPI' },
  { wrong: /出血份/g,  correct: '出血位', msg: '印刷出血建議使用標準名詞「出血位」或「出血線」', ruleId: 'TYPO_ZH_BLEED' },
  { wrong: /出雪/g,    correct: '出血',   msg: '「出雪」為同音錯字，應修正為「出血」', ruleId: 'TYPO_ZH_BLEED2' },
  { wrong: /刀模線條/g, correct: '刀模線', msg: '「刀模線條」建議精簡為業界標準「刀模線」', ruleId: 'PREPRESS_DIELINE' },
  { wrong: /Pantne/gi, correct: 'Pantone', msg: '專色名稱拼寫錯誤，應為「Pantone」', ruleId: 'PREPRESS_PANTONE' },
  { wrong: /Patone/gi, correct: 'Pantone', msg: '專色名稱拼寫錯誤，應為「Pantone」', ruleId: 'PREPRESS_PANTONE' },

  // Common Commercial & Advertising Typo Rules (Traditional Chinese)
  { wrong: /開幕志慶/g, correct: '開幕誌慶', msg: '「開幕志慶」應為「開幕誌慶」', ruleId: 'TYPO_ZH_CELEBRATE' },
  { wrong: /按裝/g,     correct: '安裝',     msg: '「按裝」應修正為「安裝」', ruleId: 'TYPO_ZH_INSTALL' },
  { wrong: /再接再勵/g, correct: '再接再厲', msg: '「再接再勵」應修正為「再接再厲」', ruleId: 'TYPO_ZH_IDIOM' },
  { wrong: /名信片/g,   correct: '明信片',   msg: '「名信片」應修正為「明信片」', ruleId: 'TYPO_ZH_POSTCARD' },
  { wrong: /幅射/g,     correct: '輻射',     msg: '「幅射」應修正為「輻射」', ruleId: 'TYPO_ZH_RADIATION' },
  { wrong: /帳單/g,     correct: '帳單',     msg: '帳單用語建議統一', ruleId: 'TYPO_ZH_BILL' },
  { wrong: /即時/g,     correct: '即時',     msg: '即時用語檢查通過', ruleId: 'TYPO_ZH_INSTANT' }
];

const resultCache = new LruCache<string, SpellCheckResult>(200);

export class FreeSpellCheckClient {

  /**
   * Checks text against the local regex typo dictionary. 100% local, no network call — genuinely.
   */
  public static async checkText(
    text: string,
    language = 'zh-TW'
  ): Promise<SpellCheckResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { hasIssues: false, matches: [], language, source: 'local' };
    }

    const cacheKey = `${language}_${trimmed}`;
    if (resultCache.has(cacheKey)) {
      const cached = resultCache.get(cacheKey)!;
      return { ...cached, source: 'cache' };
    }

    const matches: SpellCheckMatch[] = [];

    for (const rule of LOCAL_TYPO_RULES) {
      const regex = new RegExp(rule.wrong.source, rule.wrong.flags.replace('g', '') + 'g');
      let m: RegExpExecArray | null;
      while ((m = regex.exec(trimmed)) !== null) {
        matches.push({
          message: rule.msg,
          offset: m.index,
          length: m[0].length,
          ruleId: rule.ruleId,
          replacements: [rule.correct],
          contextText: trimmed.slice(Math.max(0, m.index - 10), m.index + m[0].length + 10)
        });
      }
    }

    const result: SpellCheckResult = {
      hasIssues: matches.length > 0,
      matches,
      language,
      source: 'local',
      endpoint: '本機正規表示式字典'
    };

    resultCache.set(cacheKey, result);
    return result;
  }
}
