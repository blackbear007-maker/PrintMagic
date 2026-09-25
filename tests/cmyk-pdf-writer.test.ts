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
/** [clipX, clipY, clipW, clipH, imageW, imageH, imageX, imageY] from `q x y w h re W n a 0 0 d e f cm /Im0 Do Q`. */
const placement = (pdf: string) =>
  pdf.match(/q (\S+) (\S+) (\S+) (\S+) re W n (\S+) 0 0 (\S+) (\S+) (\S+) cm \/Im0 Do Q/)!.slice(1).map(Number);

describe('CmykPdfWriter', () => {
  const a4 = PRINT_PRESETS['poster-a4'];

  it('writes a PDF whose xref offsets point at every object', () => {
    const bytes = CmykPdfWriter.build({ preset: a4, pages: [raster()] });
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
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, pages: [r] }));
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
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, pages: [raster()] }));
    expect(pdf).toContain('/OutputIntents [3 0 R]');
    expect(pdf).toContain('/OutputConditionIdentifier (JC200103) /RegistryName (http://www.color.org)');
    expect(pdf).toContain('/OutputCondition (Japan Color 2001 Coated)');
    expect(pdf).not.toContain('/DestOutputProfile');
    expect(pdf).toContain('/Trapped /False');
  });

  it('sets MediaBox, BleedBox and TrimBox from the preset (A4, 3mm bleed, 12mm mark margin)', () => {
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, pages: [raster(3, 4)] }));
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
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, pages: [raster()] }));
    expect(pdf).toContain('/ColorSpace << /CS0 [/Separation /All /DeviceCMYK 4 0 R] >>');
    expect(pdf).toContain('/CS0 CS 1 SCN');
    for (const patch of ['1 0 0 0 k', '0 1 0 0 k', '0 0 1 0 k', '0 0 0 1 k', '0.5 0 0 0 k', '0 0 0 0.5 k']) {
      expect(pdf).toContain(patch);
    }
  });

  it('writes one page per raster sharing the layout, each with its own image (double-sided)', () => {
    const front = raster(4, 3);
    const back = { ...raster(6, 2), flateData: new Uint8Array(deflateSync(new Uint8Array(6 * 2 * 4).fill(9))) };
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, pages: [front, back] }));
    expect(pdf).toContain('/Kids [6 0 R 9 0 R] /Count 2');
    expect(pdf).toContain('/XObject << /Im0 7 0 R >>');
    expect(pdf).toContain('/XObject << /Im0 10 0 R >>');
    expect(pdf).toContain('/Contents 8 0 R');
    expect(pdf).toContain('/Contents 11 0 R');
    expect(pdf).toMatch(/\/Width 4 \/Height 3 \/ColorSpace \/DeviceCMYK/);
    expect(pdf).toMatch(/\/Width 6 \/Height 2 \/ColorSpace \/DeviceCMYK/);
    expect(pdf.match(/\/Type \/Page /g)!.length).toBe(2);
    expect(() => CmykPdfWriter.build({ preset: a4, pages: [front, { ...back, outputConditionIdentifier: 'FOGRA39' }] })).toThrow();
  });

  it('turns the page to the image orientation and covers trim + bleed without stretching', () => {
    // 2026-09-26: a landscape image on the portrait A4 preset used to be stretched into a portrait page.
    const landscape = { ...raster(4000, 3000), flateData: raster().flateData };
    const pdf = latin1(CmykPdfWriter.build({ preset: a4, pages: [landscape] }));
    const media = box(pdf, 'MediaBox');
    expect(media[2]).toBeGreaterThan(media[3]);
    const trim = box(pdf, 'TrimBox');
    expect(trim[2] - trim[0]).toBeCloseTo(297 * PT, 2);

    // Clipped to the bleed box, and the image matrix keeps the raster's own 4:3 ratio.
    const bleed = box(pdf, 'BleedBox');
    const [cx, cy, cw, ch, a, d] = placement(pdf);
    expect(cx).toBeCloseTo(bleed[0], 2);
    expect(cy).toBeCloseTo(bleed[1], 2);
    expect(cw).toBeCloseTo(bleed[2] - bleed[0], 2);
    expect(ch).toBeCloseTo(bleed[3] - bleed[1], 2);
    expect(a / d).toBeCloseTo(4000 / 3000, 3);
    expect(a).toBeGreaterThanOrEqual(cw - 0.01);
    expect(d).toBeGreaterThanOrEqual(ch - 0.01);
  });

  it('keeps the anchored part of an image whose ratio differs from the page', () => {
    const wide = { ...raster(6000, 3000), flateData: raster().flateData }; // 2:1 on landscape A4 (~1.4:1)
    const left = latin1(CmykPdfWriter.build({ preset: a4, pages: [wide], anchor: 'left' }));
    const right = latin1(CmykPdfWriter.build({ preset: a4, pages: [wide], anchor: 'right' }));
    const bleedLeft = box(left, 'BleedBox')[0];
    expect(placement(left)[6]).toBeCloseTo(bleedLeft, 2); // image's left edge on the left bleed edge
    expect(placement(right)[6]).toBeLessThan(bleedLeft - 10); // shifted left: the right side is kept
  });

  it('omits the mark margin and marks for presets without them, and encodes non-ASCII titles', () => {
    const social = PRINT_PRESETS['social'];
    const pdf = latin1(CmykPdfWriter.build({ preset: { ...social, cropMarks: false, registrationMarks: false, colorBars: false }, pages: [raster()], title: '海報' }));
    expect(pdf).not.toContain('/CS0 CS');
    expect(pdf).not.toMatch(/ k \d/);
    expect(box(pdf, 'MediaBox')).toEqual(box(pdf, 'BleedBox'));
    expect(pdf).toContain('/Title <FEFF6D775831>');
  });
});
