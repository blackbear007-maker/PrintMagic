import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const generatorPath = path.join(root, 'tools', 'generate-xiaoxiang-lifestyle-assets.mjs');
const states = ['idle', 'hello', 'think', 'thumbs', 'cheer'];
const assetIds = states.flatMap((state) => [state, `${state}-blink`]);

describe('Xiaoxiang generated avatar assets', () => {
  it('generator exposes the approved ten avatar states', async () => {
    const source = await fs.readFile(generatorPath, 'utf8');
    for (const state of states) expect(source).toMatch(new RegExp(`[\"']${state}[\"']`));
    expect(source).toMatch(/\$\{state\}-blink/);
  });

  it('keeps outputs and both Google image models documented', async () => {
    const source = await fs.readFile(generatorPath, 'utf8');
    expect(source).toMatch(/public[\\/]xiaoxiang/);
    expect(source).toMatch(/avatar-provenance\.json/);
    expect(source).toMatch(/gemini-3\.1-flash-lite-image/);
    expect(source).toMatch(/gemini-2\.5-flash-image/);
  });

  it('keeps the legacy avatar available as fallback', async () => {
    const legacy = path.join(root, 'public', 'xiaoxiang.jpg');
    const stat = await fs.stat(legacy);
    expect(stat.size).toBeGreaterThan(1024);
  });

  it('accepts present generated files only when they are valid WebP images', async () => {
    for (const id of assetIds) {
      const file = path.join(root, 'public', 'xiaoxiang', `${id}.webp`);
      try {
        const bytes = await fs.readFile(file);
        expect(bytes.length, `${id} is too small`).toBeGreaterThan(1024);
        expect(bytes.subarray(0, 4).toString('ascii'), `${id} is not RIFF`).toBe('RIFF');
        expect(bytes.subarray(8, 12).toString('ascii'), `${id} is not WebP`).toBe('WEBP');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  });
});
