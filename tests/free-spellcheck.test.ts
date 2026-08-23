import { describe, it, expect } from 'vitest';
import { FreeSpellCheckClient } from '../src/services/free-spellcheck-client';

describe('FreeSpellCheckClient (100% Offline Pre-Press Spellcheck)', () => {
  it('should return no issues for empty or clean text', async () => {
    const emptyResult = await FreeSpellCheckClient.checkText('');
    expect(emptyResult.hasIssues).toBe(false);
    expect(emptyResult.matches).toHaveLength(0);

    const cleanResult = await FreeSpellCheckClient.checkText('色彩模式為標準 CMYK 格式');
    expect(cleanResult.hasIssues).toBe(false);
  });

  it('should detect print terminology typos (CMKY -> CMYK)', async () => {
    const result = await FreeSpellCheckClient.checkText('請幫我轉為 CMKY 模式');
    expect(result.hasIssues).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].replacements).toContain('CMYK');
  });

  it('should detect traditional Chinese idiom typos (開幕志慶 -> 開幕誌慶)', async () => {
    const result = await FreeSpellCheckClient.checkText('祝賀貴公司 開幕志慶');
    expect(result.hasIssues).toBe(true);
    expect(result.matches[0].replacements).toContain('開幕誌慶');
  });
});
