import { describe, it, expect } from 'vitest';
import { deflateSync, inflateSync } from 'node:zlib';
import { CmykPdfWriter, type CmykRaster } from '../src/engines/cmyk-pdf-writer';
import { PRINT_PRESETS } from '../src/core/presets';

const PT = 72 / 25.4;

function raster(width = 4, height = 3): CmykRaster {
  const samples = new Uint8Array(width * height * 4);
  for (let i = 0; i < samples.length; i++) samples[i] = (i * 37) & 255;
  return {
    width,
    height,
    flateData: new Uint8Array(deflateSync(samples)),
    profileId: 'japan-color-2001-coated',
    outputConditionIdentifier: 'JC200103',
    outputCondition: 'Japan Color 2001 Coated',
    tacMaxPercent: 346
  };
}

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');
const box = (pdf: string, name: string) =>
  pdf.match(new RegExp(`/${name} \\[([^\\]]+)\\]`))![1].split(' ').map(Number);

describe('CmykPdfWriter', () => {
  const a4 = PRINT_PRESETS['poster-a4'];

  it('writes a PDF whose xref offsets point at every object', () => {
    const bytes = CmykPdfWriter.build({ preset: a4, raster: raster() });
    const pdf = latin1(bytes);
    expect(pdf.startsWith('%PDF-1.3\n')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);

    const startxref = Number(pdf.match(/startxref\n(\d+)\n%%EOF/)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
    const count = Number(pdf.slice(startxref).match(/xref\n0 (\d+)\n/)![1]);
    const entries = pdf.slice(startxref).split('\n').slice(3, 3 + count - 1);
    entries.forEach((line, i) => {
      expect(line).toMatch(/^\d{10} 00000 n $/);
      const off = Number(line.slice(0, 10));
      expect(pdf.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    expect(pdf).toContain(`/Size ${count}`);
  });

  it('embeds the service samples untouched as a DeviceCMYK image', () => {
    const r = raster(5, 2);
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, raster: r }));
    expect(pdf).toMatch(/\/Subtype \/Image \/Width 5 \/Height 2 \/ColorSpace \/DeviceCMYK \/BitsPerComponent 8 \/Filter \/FlateDecode/);
    const len = Number(pdf.match(/\/DeviceCMYK[^>]*\/Length (\d+)/)![1]);
    expect(len).toBe(r.flateData.length);
    const start = pdf.indexOf('stream\n', pdf.indexOf('/DeviceCMYK')) + 'stream\n'.length;
    const stream = Buffer.from(pdf.slice(start, start + len), 'latin1');
    expect(new Uint8Array(inflateSync(stream))).toEqual(new Uint8Array(inflateSync(Buffer.from(r.flateData))));
    // No RGB anywhere in the file.
    expect(pdf).not.toMatch(/DeviceRGB|\/CalRGB| rg\b| RG\b/);
  });

  it('names the printing condition without embedding a profile', () => {
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, raster: raster() }));
    expect(pdf).toContain('/OutputIntents [5 0 R]');
    expect(pdf).toContain('/OutputConditionIdentifier (JC200103) /RegistryName (http://www.color.org)');
    expect(pdf).toContain('/OutputCondition (Japan Color 2001 Coated)');
    expect(pdf).not.toContain('/DestOutputProfile');
    expect(pdf).toContain('/Trapped /False');
  });

  it('sets MediaBox, BleedBox and TrimBox from the preset (A4, 3mm bleed, 12mm mark margin)', () => {
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, raster: raster() }));
    const media = box(pdf, 'MediaBox');
    const bleed = box(pdf, 'BleedBox');
    const trim = box(pdf, 'TrimBox');
    expect(media[2]).toBeCloseTo((210 + 30) * PT, 2);
    expect(media[3]).toBeCloseTo((297 + 30) * PT, 2);
    expect(trim[2] - trim[0]).toBeCloseTo(210 * PT, 2);
    expect(trim[3] - trim[1]).toBeCloseTo(297 * PT, 2);
    expect(trim[0] - bleed[0]).toBeCloseTo(3 * PT, 2);
    expect(bleed[0]).toBeCloseTo(12 * PT, 2);
  });

  it('draws marks in the registration separation and colour bars as CMYK solids and tints', () => {
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, raster: raster() }));
    expect(pdf).toContain('/ColorSpace << /CS0 [/Separation /All /DeviceCMYK 7 0 R] >>');
    expect(pdf).toContain('/CS0 CS 1 SCN');
    for (const patch of ['1 0 0 0 k', '0 1 0 0 k', '0 0 1 0 k', '0 0 0 1 k', '0.5 0 0 0 k', '0 0 0 0.5 k']) {
      expect(pdf).toContain(patch);
    }
  });

  it('omits the mark margin and marks for presets without them, and encodes non-ASCII titles', () => {
    const social = PRINT_PRESETS['social'];
    const pdf = latin1(CmykPdfWriter.build({ preset: { ...social, cropMarks: false, registrationMarks: false, colorBars: false }, raster: raster(), title: '海報' }));
    expect(pdf).not.toContain('/CS0 CS');
    expect(pdf).not.toMatch(/ k \d/);
    expect(box(pdf, 'MediaBox')).toEqual(box(pdf, 'BleedBox'));
    expect(pdf).toContain('/Title <FEFF6D775831>');
  });
});
