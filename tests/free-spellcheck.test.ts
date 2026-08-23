import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FreeSpellCheckClient } from '../src/services/free-spellcheck-client';

describe('FreeSpellCheckClient (LanguageTool Free Proofreading API)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return no issues for short or empty text without network calls', async () => {
    const emptyResult = await FreeSpellCheckClient.checkText('');
    expect(emptyResult.hasIssues).toBe(false);
    expect(emptyResult.matches).toHaveLength(0);

    const singleCharResult = await FreeSpellCheckClient.checkText('a');
    expect(singleCharResult.hasIssues).toBe(false);
  });

  it('should mock and parse LanguageTool response correctly with replacement suggestions', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        language: { code: 'en-US' },
        matches: [
          {
            message: 'Possible spelling mistake found.',
            offset: 0,
            length: 5,
            rule: { id: 'MORFOLOGIK_RULE_EN_US' },
            replacements: [{ value: 'coffee' }, { value: 'coffer' }],
            context: { text: 'cofee is good' }
          }
        ]
      })
    } as any);

    const result = await FreeSpellCheckClient.checkText('cofee is good', 'en-US');

    expect(result.hasIssues).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].replacements).toContain('coffee');
    expect(result.language).toBe('en-US');
  });

  it('should gracefully fallback when network fails or times out', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const result = await FreeSpellCheckClient.checkText('Random text checking', 'en-US');
    expect(result).toBeDefined();
    expect(result.hasIssues).toBe(false);
  });
});
