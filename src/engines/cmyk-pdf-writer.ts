import type { PrintPreset } from '../types';

/**
 * A CMYK raster produced by the self-hosted separation service (docker/zero-dce/cmyk_convert.py).
 * `flateData` is zlib-compressed 8-bit DeviceCMYK samples (0 = no ink, 255 = full ink), row-major,
 * no predictor — i.e. already a valid PDF /FlateDecode image stream.
 */
export interface CmykRaster {
  width: number;
  height: number;
  flateData: Uint8Array;
  profileId: string;
  /** ICC-registered characterization name, e.g. "JC200103" (registry.color.org/cmyk-registry). */
  outputConditionIdentifier: string;
  /** Human-readable condition, e.g. "Japan Color 2001 Coated". */
  outputCondition: string;
  tacMaxPercent?: number;
  tacMeanPercent?: number;
}

export interface CmykPdfOptions {
  preset: PrintPreset;
  raster: CmykRaster;
  title?: string;
  now?: Date;
}

const PT_PER_MM = 72 / 25.4;

/**
 * Writes a one-page CMYK print PDF (2026-09-25) — jsPDF can only place RGB images, so this emits the
 * PDF 1.3 objects directly. Same page geometry as PdfExporter's RGB layout (artwork over trim + bleed,
 * crop marks, registration targets, colour bars), with:
 *   - the artwork as a DeviceCMYK image (the service's samples, not re-encoded);
 *   - crop/registration marks in the /All separation (registration colour, prints on every plate);
 *   - colour bars as real CMYK solids and 50% tints instead of RGB approximations;
 *   - MediaBox / BleedBox / TrimBox;
 *   - an OutputIntent naming the ICC-registered printing condition. The profile itself is NOT
 *     embedded (Adobe's profiles stay on our server, see cmyk_convert.py).
 * It carries no text (no fonts to embed) and makes no PDF/X conformance claim: the structure follows
 * PDF/X-1a's rules as far as this writer knows them, but the file has not been through a preflight tool.
 */
export class CmykPdfWriter {
  public static build({ preset, raster, title = 'PrintMagic print file', now = new Date() }: CmykPdfOptions): Uint8Array<ArrayBuffer> {
    const bleedMm = preset.bleedMm || 0;
    const trimWmm = preset.widthMm > 0 ? preset.widthMm : 210;
    const trimHmm = preset.heightMm > 0 ? preset.heightMm : 297;
    const outerMm = preset.cropMarks ? 12 : 0;
    const pageWmm = trimWmm + (bleedMm + outerMm) * 2;
    const pageHmm = trimHmm + (bleedMm + outerMm) * 2;
    const contentWmm = trimWmm + bleedMm * 2;
    const contentHmm = trimHmm + bleedMm * 2;
    const trimXmm = outerMm + bleedMm;
    const trimYmm = outerMm + bleedMm;

    // Layout below is in mm with a top-left origin (same numbers as PdfExporter.buildPdf); these
    // convert to PDF points with the bottom-left origin.
    const X = (mm: number) => mm * PT_PER_MM;
    const Y = (mmFromTop: number) => (pageHmm - mmFromTop) * PT_PER_MM;

    const ops: string[] = [];
    ops.push(`q ${n(X(contentWmm))} 0 0 ${n(X(contentHmm))} ${n(X(outerMm))} ${n(Y(outerMm + contentHmm))} cm /Im0 Do Q`);

    if (preset.cropMarks || preset.registrationMarks) {
      ops.push(`q /CS0 CS 1 SCN ${n(0.1 * PT_PER_MM)} w`);
      const line = (x1: number, y1: number, x2: number, y2: number) =>
        ops.push(`${n(X(x1))} ${n(Y(y1))} m ${n(X(x2))} ${n(Y(y2))} l S`);

      if (preset.cropMarks) {
        const markLen = 6;
        const off = bleedMm + 1.5; // start outside the bleed so marks never touch the artwork
        const r = trimXmm + trimWmm;
        const b = trimYmm + trimHmm;
        line(trimXmm - off - markLen, trimYmm, trimXmm - off, trimYmm);
        line(trimXmm, trimYmm - off - markLen, trimXmm, trimYmm - off);
        line(r + off, trimYmm, r + off + markLen, trimYmm);
        line(r, trimYmm - off - markLen, r, trimYmm - off);
        line(trimXmm - off - markLen, b, trimXmm - off, b);
        line(trimXmm, b + off, trimXmm, b + off + markLen);
        line(r + off, b, r + off + markLen, b);
        line(r, b + off, r, b + off + markLen);
      }

      if (preset.registrationMarks) {
        const targets = [
          { x: trimXmm + trimWmm / 2, y: outerMm / 2 },
          { x: trimXmm + trimWmm / 2, y: pageHmm - outerMm / 2 },
          { x: outerMm / 2, y: trimYmm + trimHmm / 2 },
          { x: pageWmm - outerMm / 2, y: trimYmm + trimHmm / 2 }
        ];
        for (const t of targets) {
          ops.push(circlePath(X(t.x), Y(t.y), X(2)) + ' S');
          line(t.x - 3.5, t.y, t.x + 3.5, t.y);
          line(t.x, t.y - 3.5, t.x, t.y + 3.5);
        }
      }
      ops.push('Q');
    }

    if (preset.colorBars) {
      const barTop = outerMm / 2 - 1.5;
      const size = 3;
      const patches: [number, number, number, number][] = [
        [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1],
        [0.5, 0, 0, 0], [0, 0.5, 0, 0], [0, 0, 0.5, 0], [0, 0, 0, 0.5]
      ];
      patches.forEach(([c, m, y, k], i) => {
        const x = trimXmm + 5 + i * (size + 0.5);
        ops.push(`${c} ${m} ${y} ${k} k ${n(X(x))} ${n(Y(barTop + size))} ${n(X(size))} ${n(X(size))} re f`);
      });
    }

    const content = ascii(ops.join('\n') + '\n');
    const mediaBox = `[0 0 ${n(X(pageWmm))} ${n(X(pageHmm))}]`;
    const box = (x: number, y: number, w: number, h: number) =>
      `[${n(X(x))} ${n(Y(y + h))} ${n(X(x + w))} ${n(Y(y))}]`;
    const date = pdfDate(now);

    const objects: (string | { dict: string; stream: Uint8Array })[] = [
      /* 1 */ `<< /Type /Catalog /Pages 2 0 R /OutputIntents [5 0 R] >>`,
      /* 2 */ `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
      /* 3 */ `<< /Type /Page /Parent 2 0 R /MediaBox ${mediaBox} /BleedBox ${box(outerMm, outerMm, contentWmm, contentHmm)} ` +
        `/TrimBox ${box(trimXmm, trimYmm, trimWmm, trimHmm)} ` +
        `/Resources << /XObject << /Im0 4 0 R >> /ColorSpace << /CS0 [/Separation /All /DeviceCMYK 7 0 R] >> >> /Contents 6 0 R >>`,
      /* 4 */ {
        dict: `<< /Type /XObject /Subtype /Image /Width ${raster.width} /Height ${raster.height} /ColorSpace /DeviceCMYK ` +
          `/BitsPerComponent 8 /Filter /FlateDecode /Length ${raster.flateData.length} >>`,
        stream: raster.flateData
      },
      /* 5 */ `<< /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier ${pdfString(raster.outputConditionIdentifier)} ` +
        `/RegistryName (http://www.color.org) /OutputCondition ${pdfString(raster.outputCondition)} /Info ${pdfString(raster.outputCondition)} >>`,
      /* 6 */ { dict: `<< /Length ${content.length} >>`, stream: content },
      /* 7 */ `<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [1 1 1 1] /N 1 >>`,
      /* 8 */ `<< /Title ${pdfString(title)} /Creator (PrintMagic) /Producer (PrintMagic CMYK PDF writer) ` +
        `/CreationDate (${date}) /ModDate (${date}) /Trapped /False >>`
    ];

    const chunks: Uint8Array[] = [];
    let offset = 0;
    const push = (bytes: Uint8Array) => {
      chunks.push(bytes);
      offset += bytes.length;
    };
    push(ascii('%PDF-1.3\n'));
    push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker comment

    const offsets: number[] = [];
    objects.forEach((obj, i) => {
      offsets.push(offset);
      if (typeof obj === 'string') {
        push(ascii(`${i + 1} 0 obj\n${obj}\nendobj\n`));
      } else {
        push(ascii(`${i + 1} 0 obj\n${obj.dict}\nstream\n`));
        push(obj.stream);
        push(ascii('\nendstream\nendobj\n'));
      }
    });

    const xrefOffset = offset;
    const id = randomHex(16);
    push(ascii(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
      offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R /ID [<${id}> <${id}>] >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`
    ));

    const out = new Uint8Array(offset);
    let p = 0;
    for (const c of chunks) {
      out.set(c, p);
      p += c.length;
    }
    return out;
  }
}

/** PDF number: up to 3 decimals, no exponent, no trailing zeros. */
function n(v: number): string {
  const s = (Math.round(v * 1000) / 1000).toFixed(3);
  return s.replace(/\.?0+$/, '') || '0';
}

function ascii(s: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0x7e) throw new Error('CmykPdfWriter: non-ASCII byte in PDF syntax');
    out[i] = c;
  }
  return out;
}

/** Literal string for ASCII text, UTF-16BE hex string (with BOM) otherwise — e.g. Chinese titles. */
function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

function pdfDate(d: Date): string {
  const p = (v: number) => String(v).padStart(2, '0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** Circle as four Bézier arcs (PDF has no circle operator). */
function circlePath(cx: number, cy: number, r: number): string {
  const k = r * 0.5522847498;
  return [
    `${n(cx + r)} ${n(cy)} m`,
    `${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c`,
    `${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)} c`,
    `${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c`,
    `${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)} c`
  ].join(' ');
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buf);
  else for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
