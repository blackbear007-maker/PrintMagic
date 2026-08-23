import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeSpellCheckClient } from '../src/services/free-spellcheck-client';

describe('FreeSpellCheckClient (100% 離線印前字典樹與隱私校對)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return no issues for empty or whitespace strings', async () => {
    const res = await FreeSpellCheckClient.checkText(' ');
    expect(res.hasIssues).toBe(false);
    expect(res.matches.length).toBe(0);
    expect(res.source).toBe('local');
  });

  it('should catch printing typos using local dictionary with zero network calls', async () => {
    const res = await FreeSpellCheckClient.checkText('這張圖片的色彩模式是 CMTK，而且解晰度不足 300 dip');
    expect(res.hasIssues).toBe(true);
    expect(res.source).toBe('local');
    expect(res.matches.some(m => m.replacements.includes('CMYK'))).toBe(true);
    expect(res.matches.some(m => m.replacements.includes('解析度'))).toBe(true);
    expect(res.matches.some(m => m.replacements.includes('DPI'))).toBe(true);
  });

  it('should catch traditional Chinese common idioms and advertising typos', async () => {
    const res = await FreeSpellCheckClient.checkText('祝賀公司開幕志慶，全體員工再接再勵');
    expect(res.hasIssues).toBe(true);
    expect(res.matches.some(m => m.replacements.includes('開幕誌慶'))).toBe(true);
    expect(res.matches.some(m => m.replacements.includes('再接再厲'))).toBe(true);
  });

  it('should return clean result for correct print terminology', async () => {
    const res = await FreeSpellCheckClient.checkText('300 DPI CMYK 出血位標準圖檔');
    expect(res.hasIssues).toBe(false);
    expect(res.matches.length).toBe(0);
  });

  it('should return local endpoint status metrics', () => {
    const statuses = FreeSpellCheckClient.getEndpointStatus();
    expect(statuses.length).toBe(3);
    statuses.forEach(s => {
      expect(s.tokensLeft).toBeGreaterThanOrEqual(0);
      expect(s.maxTokens).toBeGreaterThan(0);
    });
  });
});
