/**
 * Realistic REGION-LOCALIZATION benchmark for TextInspector.detectTextRegions().
 *
 * Why this file exists
 * --------------------
 * The older unit tests (tests/text-inspector.test.ts) feed the detector dense dither bands such as
 * `(x + y) % 4 === 0`: every few pixels is a hard edge, so any edge-density heuristic lights up.
 * Real rendered type is nothing like that. Glyphs are solid strokes whose only edges are the 1-3 px
 * anti-aliased stroke boundaries, a text line usually covers a minority of the image width, and it
 * often sits on a smooth gradient or a photo. In a real browser, a 1200x800 diagonal-gradient image
 * with white bold 90px "Hello 印刷" (after the app's ~1.42x upscale + 2 mm bleed + light sharpen,
 * ~1740x1170) came back with ZERO regions. This file reproduces that class of input without needing
 * a font rasterizer (there is no canvas / font engine in the vitest Node environment).
 *
 * How the synthetic text is made
 * ------------------------------
 * - A tiny procedural stroke font. Latin capitals / lowercase are built from thick straight strokes
 *   plus polyline-approximated curves (stroke width ~0.125 x cap height regular, ~0.17 x cap height
 *   bold — see STROKE_EM; letter gaps ~0.1-0.2 x cap height; word space ~0.35 x cap height).
 *   CJK-like glyphs are square cells with 4-8 horizontal / vertical / falling strokes: two hand-built
 *   approximations of 印 and 刷, the rest generated from a PRNG seeded by the code point (so they
 *   are "CJK-shaped", not the real characters).
 * - Analytic-coverage anti-aliasing: each stroke is a capsule around its centre line, and a pixel's
 *   coverage is clamp(halfWidth + 0.5 - distance, 0, 1) -> a ~1 px soft edge, colour-blended onto
 *   the background. Most scenes then get a 3x3 [1 2 1] blur (resampling), and P1/N1 go through the
 *   bug's actual upscale path (bilinear x1.42 -> edge-extended bleed -> light unsharp mask).
 * - Backgrounds: flat, multi-stop linear gradients, and a "photo-like" background (low-frequency
 *   colour blobs, a few soft-edged defocused shapes, mild texture and per-pixel noise).
 * - Everything is deterministic: seeded PRNG (mulberry32), never Math.random.
 *
 * What is measured
 * ----------------
 * FreeOcrClient is mocked exactly like tests/text-inspector.test.ts (recognizeRegion -> null,
 * imageDataToCanvas -> {}), so only the localization half of detectTextRegions() is exercised.
 *
 * Pass criteria
 * - Positive: some returned region covers >= 80 % of the true ink bbox AND is no taller than 2.5x the
 *   ink bbox (so a whole-image / whole-band box does not count). In addition no returned region may
 *   lie entirely off the text: each false region costs one OCR call (up to 8 s) and makes the score
 *   card say the wrong "偵測到 N 處文字區塊".
 * - Negative: zero regions.
 * - PERF: localization of a 6000x4000 image stays under 600 ms (loose for CI; actual time is logged).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FreeOcrClient exactly like tests/text-inspector.test.ts so no Tesseract worker is started
// and only region localization is measured.
const mockRecognizeRegion = vi.fn();
const mockImageDataToCanvas = vi.fn();
vi.mock('../src/services/free-ocr-client', () => ({
  FreeOcrClient: {
    recognizeRegion: (...args: any[]) => mockRecognizeRegion(...args),
    imageDataToCanvas: (...args: any[]) => mockImageDataToCanvas(...args)
  },
  OCR_MIN_TRUSTED_CONFIDENCE: 60
}));

import { TextInspector } from '../src/core/text-inspector';

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Basic types, deterministic PRNG, colour helpers
// ───────────────────────────────────────────────────────────────────────────────────────────────

type RGB = readonly [number, number, number];
type Pt = readonly [number, number];
interface Box { x: number; y: number; width: number; height: number }

/** mulberry32: tiny, fast, deterministic 32-bit PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const WHITE = hex('#ffffff');
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Same luminance weights the detector uses. */
const lumaAt = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Image helpers (all operate on plain RGBA ImageData-shaped objects; alpha is always 255)
// ───────────────────────────────────────────────────────────────────────────────────────────────

function makeImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

function cloneImage(img: ImageData): ImageData {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data), colorSpace: 'srgb' } as ImageData;
}

function fillFlat(img: ImageData, c: RGB): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
}

/** Multi-stop linear gradient from `from` to `to` (like canvas createLinearGradient), 8-bit rounded. */
function fillLinearGradient(img: ImageData, stops: ReadonlyArray<readonly [number, RGB]>, from: Pt, to: Pt): void {
  const { width: w, height: h, data: d } = img;
  const vx = to[0] - from[0];
  const vy = to[1] - from[1];
  const len2 = vx * vx + vy * vy || 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = clamp(((x + 0.5 - from[0]) * vx + (y + 0.5 - from[1]) * vy) / len2, 0, 1);
      let k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const [t0, c0] = stops[k];
      const [t1, c1] = stops[k + 1];
      const f = t1 > t0 ? clamp((t - t0) / (t1 - t0), 0, 1) : 0;
      const i = (y * w + x) * 4;
      d[i] = c0[0] + (c1[0] - c0[0]) * f;
      d[i + 1] = c0[1] + (c1[1] - c0[1]) * f;
      d[i + 2] = c0[2] + (c1[2] - c0[2]) * f;
      d[i + 3] = 255;
    }
  }
}

/**
 * "Photo-like" background: a smooth two-colour base, low-frequency colour blobs, a few soft-edged
 * (defocused) shapes with a 10-16 px edge ramp, mild mid-frequency texture — all computed on a 1/8
 * resolution field and bilinearly upsampled — plus mild per-pixel luminance noise (sigma ~ noiseSigma).
 */
function fillPhotoLike(img: ImageData, seed: number, palette: readonly RGB[], noiseSigma: number): void {
  const { width: w, height: h, data: d } = img;
  const rnd = mulberry32(seed);
  const F = 8;
  const cw = Math.ceil(w / F) + 1;
  const ch = Math.ceil(h / F) + 1;
  const field = new Float32Array(cw * ch * 3);
  const minDim = Math.min(w, h);

  // 1. Base: vertical blend between the first two palette colours ("sky" -> "ground").
  const top = palette[0];
  const bottom = palette[1];
  for (let cy = 0; cy < ch; cy++) {
    const t = cy / (ch - 1);
    for (let cx = 0; cx < cw; cx++) {
      const j = (cy * cw + cx) * 3;
      for (let c = 0; c < 3; c++) field[j + c] = top[c] + (bottom[c] - top[c]) * t;
    }
  }

  // 2. Low-frequency Gaussian colour blobs.
  for (let b = 0; b < 9; b++) {
    const bx = rnd() * w;
    const by = rnd() * h;
    const r = (0.08 + rnd() * 0.27) * minDim;
    const base = palette[Math.floor(rnd() * palette.length)];
    const col = [base[0] + (rnd() - 0.5) * 30, base[1] + (rnd() - 0.5) * 30, base[2] + (rnd() - 0.5) * 30];
    const strength = 0.35 + rnd() * 0.5;
    const inv2r2 = 1 / (2 * r * r);
    for (let cy = 0; cy < ch; cy++) {
      const dy = cy * F - by;
      for (let cx = 0; cx < cw; cx++) {
        const dx = cx * F - bx;
        const wgt = strength * Math.exp(-(dx * dx + dy * dy) * inv2r2);
        if (wgt < 0.002) continue;
        const j = (cy * cw + cx) * 3;
        for (let c = 0; c < 3; c++) field[j + c] = field[j + c] * (1 - wgt) + col[c] * wgt;
      }
    }
  }

  // 3. Soft-edged (defocused) shapes: +-20..45 luminance, 10-16 px smoothstep edge ramp.
  for (let s = 0; s < 4; s++) {
    const sx = rnd() * w;
    const sy = rnd() * h;
    const rx = (0.05 + rnd() * 0.15) * minDim;
    const ry = (0.05 + rnd() * 0.15) * minDim;
    const shift = (rnd() < 0.5 ? -1 : 1) * (20 + rnd() * 25);
    const soft = 10 + rnd() * 6;
    const rmin = Math.min(rx, ry);
    for (let cy = 0; cy < ch; cy++) {
      const dy = (cy * F - sy) / ry;
      for (let cx = 0; cx < cw; cx++) {
        const dx = (cx * F - sx) / rx;
        const dist = (Math.sqrt(dx * dx + dy * dy) - 1) * rmin; // ~px distance to the boundary
        const u = clamp((dist + soft / 2) / soft, 0, 1);
        const a = 1 - u * u * (3 - 2 * u);
        if (a <= 0) continue;
        const j = (cy * cw + cx) * 3;
        for (let c = 0; c < 3; c++) field[j + c] += shift * a;
      }
    }
  }

  // 4. Mild mid-frequency texture (+-3 luminance per coarse cell, i.e. 8 px features after upsampling).
  for (let j = 0; j < cw * ch; j++) {
    const n = (rnd() - 0.5) * 6;
    field[j * 3] += n; field[j * 3 + 1] += n; field[j * 3 + 2] += n;
  }

  // 5. Bilinear upsample to full resolution + mild per-pixel luminance noise (triangular distribution).
  const noiseScale = noiseSigma / 0.408; // sigma of (u1 - u2) is 1/sqrt(6)
  const x0s = new Int32Array(w);
  const fxs = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const gx = x / F;
    x0s[x] = Math.floor(gx);
    fxs[x] = gx - x0s[x];
  }
  for (let y = 0; y < h; y++) {
    const gy = y / F;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    const r0 = y0 * cw;
    const r1 = Math.min(ch - 1, y0 + 1) * cw;
    for (let x = 0; x < w; x++) {
      const x0 = x0s[x];
      const x1 = Math.min(cw - 1, x0 + 1);
      const fx = fxs[x];
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const a = (r0 + x0) * 3, b = (r0 + x1) * 3, c2 = (r1 + x0) * 3, e = (r1 + x1) * 3;
      const n = (rnd() - rnd()) * noiseScale;
      const i = (y * w + x) * 4;
      d[i] = field[a] * w00 + field[b] * w10 + field[c2] * w01 + field[e] * w11 + n;
      d[i + 1] = field[a + 1] * w00 + field[b + 1] * w10 + field[c2 + 1] * w01 + field[e + 1] * w11 + n;
      d[i + 2] = field[a + 2] * w00 + field[b + 2] * w10 + field[c2 + 2] * w01 + field[e + 2] * w11 + n;
      d[i + 3] = 255;
    }
  }
}

/** Solid rectangle with exact area-coverage anti-aliasing on fractional edges. */
function fillRectAA(img: ImageData, x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const { width: w, data: d } = img;
  for (let py = Math.floor(y0); py < Math.ceil(y1); py++) {
    const oy = Math.min(py + 1, y1) - Math.max(py, y0);
    for (let px = Math.floor(x0); px < Math.ceil(x1); px++) {
      const ox = Math.min(px + 1, x1) - Math.max(px, x0);
      const cov = clamp(ox * oy, 0, 1);
      const i = (py * w + px) * 4;
      for (let k = 0; k < 3; k++) d[i + k] = d[i + k] + (c[k] - d[i + k]) * cov;
    }
  }
}

/** Blends colour `c` into one pixel with coverage `cov` (clipped to the image). */
function blendAt(img: ImageData, x: number, y: number, c: RGB, cov: number): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height || cov <= 0) return;
  const v = cov > 1 ? 1 : cov;
  const d = img.data;
  const i = (y * img.width + x) * 4;
  for (let k = 0; k < 3; k++) d[i + k] = d[i + k] + (c[k] - d[i + k]) * v;
}

/** Anti-aliased filled disc. */
function fillDisc(img: ImageData, cx: number, cy: number, r: number, c: RGB): void {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) blendAt(img, x, y, c, r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
  }
}

/** Anti-aliased ring between radii rIn and rOut. */
function fillRing(img: ImageData, cx: number, cy: number, rOut: number, rIn: number, c: RGB): void {
  for (let y = Math.floor(cy - rOut - 1); y <= Math.ceil(cy + rOut + 1); y++) {
    for (let x = Math.floor(cx - rOut - 1); x <= Math.ceil(cx + rOut + 1); x++) {
      const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      blendAt(img, x, y, c, Math.min(rOut + 0.5 - dd, dd - (rIn - 0.5)));
    }
  }
}

/** Filled polygon, anti-aliased by ss x ss supersampling (even-odd rule). */
function fillPoly(img: ImageData, pts: Pt[], c: RGB, ss = 4): void {
  const inside = (px: number, py: number) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      let hit = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) if (inside(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss)) hit++;
      blendAt(img, x, y, c, hit / (ss * ss));
    }
  }
}

/** In-place separable 3x3 [1 2 1]/4 blur — a stand-in for one resampling step. */
function blur121(img: ImageData): void {
  const { width: w, height: h, data: d } = img;
  const line = new Float32Array(Math.max(w, h) * 3);
  for (let y = 0; y < h; y++) {
    const base = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = base + x * 4;
      line[x * 3] = d[i]; line[x * 3 + 1] = d[i + 1]; line[x * 3 + 2] = d[i + 2];
    }
    for (let x = 0; x < w; x++) {
      const l = (x > 0 ? x - 1 : 0) * 3, m = x * 3, r = (x < w - 1 ? x + 1 : w - 1) * 3;
      const i = base + x * 4;
      for (let c = 0; c < 3; c++) d[i + c] = (line[l + c] + 2 * line[m + c] + line[r + c]) / 4;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      line[y * 3] = d[i]; line[y * 3 + 1] = d[i + 1]; line[y * 3 + 2] = d[i + 2];
    }
    for (let y = 0; y < h; y++) {
      const u = (y > 0 ? y - 1 : 0) * 3, m = y * 3, b = (y < h - 1 ? y + 1 : h - 1) * 3;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) d[i + c] = (line[u + c] + 2 * line[m + c] + line[b + c]) / 4;
    }
  }
}

/** Light unsharp mask (radius ~1 px): out = in + amount * (in - blur(in)). */
function unsharp(img: ImageData, amount: number): void {
  const blurred = cloneImage(img);
  blur121(blurred);
  const d = img.data;
  const b = blurred.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i] + amount * (d[i] - b[i]);
    d[i + 1] = d[i + 1] + amount * (d[i + 1] - b[i + 1]);
    d[i + 2] = d[i + 2] + amount * (d[i + 2] - b[i + 2]);
  }
}

/** Bilinear resize with half-pixel centres (what a canvas drawImage upscale roughly does). */
function resizeBilinear(src: ImageData, dw: number, dh: number): ImageData {
  const dst = makeImage(dw, dh);
  const { width: sw, height: sh, data: s } = src;
  const d = dst.data;
  const x0s = new Int32Array(dw), x1s = new Int32Array(dw), fxs = new Float32Array(dw);
  for (let X = 0; X < dw; X++) {
    const sx = clamp(((X + 0.5) * sw) / dw - 0.5, 0, sw - 1);
    x0s[X] = Math.floor(sx);
    x1s[X] = Math.min(sw - 1, x0s[X] + 1);
    fxs[X] = sx - x0s[X];
  }
  for (let Y = 0; Y < dh; Y++) {
    const sy = clamp(((Y + 0.5) * sh) / dh - 0.5, 0, sh - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const fy = sy - y0;
    for (let X = 0; X < dw; X++) {
      const fx = fxs[X];
      const a = (y0 * sw + x0s[X]) * 4, b = (y0 * sw + x1s[X]) * 4;
      const c = (y1 * sw + x0s[X]) * 4, e = (y1 * sw + x1s[X]) * 4;
      const o = (Y * dw + X) * 4;
      for (let k = 0; k < 3; k++) {
        const top = s[a + k] + (s[b + k] - s[a + k]) * fx;
        const bot = s[c + k] + (s[e + k] - s[c + k]) * fx;
        d[o + k] = top + (bot - top) * fy;
      }
    }
  }
  return dst;
}

/** Adds `pad` px of bleed on every side by edge extension. */
function padEdge(src: ImageData, pad: number): ImageData {
  const W = src.width + 2 * pad;
  const H = src.height + 2 * pad;
  const dst = makeImage(W, H);
  for (let Y = 0; Y < H; Y++) {
    const sy = clamp(Y - pad, 0, src.height - 1);
    for (let X = 0; X < W; X++) {
      const sx = clamp(X - pad, 0, src.width - 1);
      const i = (sy * src.width + sx) * 4;
      const o = (Y * W + X) * 4;
      dst.data[o] = src.data[i]; dst.data[o + 1] = src.data[i + 1]; dst.data[o + 2] = src.data[i + 2];
    }
  }
  return dst;
}

// The bug's post-processing path: ~1.42x upscale, 2 mm bleed (18 px per side), light sharpen.
const PIPE_SCALE = 1.42;
const PIPE_BLEED = 18;

function printPipeline(src: ImageData): ImageData {
  const up = resizeBilinear(src, Math.round(src.width * PIPE_SCALE), Math.round(src.height * PIPE_SCALE));
  const out = padEdge(up, PIPE_BLEED);
  unsharp(out, 0.5);
  return out;
}

/** Maps a box from the 1200x800 source frame into the printPipeline() output frame. */
function pipelineBox(b: Box, srcW: number, srcH: number): Box {
  const sx = Math.round(srcW * PIPE_SCALE) / srcW;
  const sy = Math.round(srcH * PIPE_SCALE) / srcH;
  return { x: b.x * sx + PIPE_BLEED, y: b.y * sy + PIPE_BLEED, width: b.width * sx, height: b.height * sy };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Procedural stroke font
// ───────────────────────────────────────────────────────────────────────────────────────────────
//
// Latin glyphs: coordinates in em, x from the glyph origin, y UP from the baseline. Cap height is
// 0.72 em (stroke centre lines run 0.05..0.67 so the ink spans ~0..0.72), x-height 0.53 em,
// ascender 0.72+ em. Advance widths include the side bearings, which gives inter-letter gaps of
// roughly 0.1-0.2 x cap height at bold weight.

interface Glyph { advance: number; strokes: Pt[][] }

/** Polyline approximation of an elliptical arc (angles in degrees, counter-clockwise, y up). */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

const LATIN: Record<string, Glyph> = {
  // Capitals
  A: { advance: 0.74, strokes: [[[0.04, 0.05], [0.37, 0.67], [0.7, 0.05]], [[0.16, 0.25], [0.58, 0.25]]] },
  D: { advance: 0.76, strokes: [[[0.1, 0.05], [0.1, 0.67], [0.34, 0.67], ...arc(0.34, 0.36, 0.32, 0.31, 90, -90, 12), [0.1, 0.05]]] },
  E: { advance: 0.64, strokes: [[[0.54, 0.67], [0.1, 0.67], [0.1, 0.05], [0.54, 0.05]], [[0.1, 0.36], [0.48, 0.36]]] },
  G: { advance: 0.78, strokes: [[...arc(0.4, 0.36, 0.3, 0.31, 40, 335, 16), [0.69, 0.32], [0.45, 0.32]]] },
  H: { advance: 0.74, strokes: [[[0.1, 0.05], [0.1, 0.67]], [[0.6, 0.05], [0.6, 0.67]], [[0.1, 0.36], [0.6, 0.36]]] },
  I: { advance: 0.3, strokes: [[[0.15, 0.05], [0.15, 0.67]]] },
  L: { advance: 0.6, strokes: [[[0.1, 0.67], [0.1, 0.05], [0.54, 0.05]]] },
  N: { advance: 0.76, strokes: [[[0.1, 0.05], [0.1, 0.67], [0.64, 0.05], [0.64, 0.67]]] },
  O: { advance: 0.8, strokes: [arc(0.4, 0.36, 0.31, 0.31, 0, 360, 20)] },
  P: { advance: 0.66, strokes: [[[0.1, 0.05], [0.1, 0.67], [0.4, 0.67], ...arc(0.4, 0.51, 0.2, 0.16, 90, -90, 8), [0.1, 0.35]]] },
  R: { advance: 0.7, strokes: [[[0.1, 0.05], [0.1, 0.67], [0.4, 0.67], ...arc(0.4, 0.52, 0.2, 0.15, 90, -90, 8), [0.1, 0.37]], [[0.34, 0.37], [0.62, 0.05]]] },
  S: { advance: 0.64, strokes: [[...arc(0.32, 0.52, 0.22, 0.15, 25, 270, 10), ...arc(0.32, 0.21, 0.24, 0.16, 90, -155, 10)]] },
  // Lowercase
  a: { advance: 0.58, strokes: [[[0.1, 0.42], [0.2, 0.48], [0.38, 0.48], [0.48, 0.4], [0.48, 0.05]], [[0.48, 0.28], [0.24, 0.28], [0.1, 0.21], [0.1, 0.11], [0.2, 0.04], [0.36, 0.05], [0.48, 0.13]]] },
  e: { advance: 0.58, strokes: [[[0.08, 0.26], [0.5, 0.26], ...arc(0.29, 0.26, 0.21, 0.22, 0, 325, 14)]] },
  l: { advance: 0.27, strokes: [[[0.135, 0.05], [0.135, 0.72]]] },
  m: { advance: 0.9, strokes: [[[0.09, 0.05], [0.09, 0.48]], [[0.09, 0.34], [0.18, 0.46], [0.34, 0.47], [0.45, 0.38], [0.45, 0.05]], [[0.45, 0.38], [0.56, 0.47], [0.72, 0.47], [0.81, 0.36], [0.81, 0.05]]] },
  o: { advance: 0.6, strokes: [arc(0.3, 0.26, 0.22, 0.22, 0, 360, 16)] },
  r: { advance: 0.4, strokes: [[[0.09, 0.05], [0.09, 0.48]], [[0.09, 0.32], [0.18, 0.44], [0.3, 0.48], [0.38, 0.47]]] },
  u: { advance: 0.6, strokes: [[[0.09, 0.48], [0.09, 0.22], ...arc(0.29, 0.22, 0.2, 0.18, 180, 360, 8)], [[0.49, 0.48], [0.49, 0.05]]] },
  // For the pattern cases (same shapes as the throwaway benchmark's extra glyphs)
  d: { advance: 0.6, strokes: [arc(0.28, 0.26, 0.2, 0.22, 0, 360, 14), [[0.48, 0.72], [0.48, 0.05]]] },
  g: { advance: 0.6, strokes: [arc(0.28, 0.28, 0.2, 0.2, 0, 360, 14), [[0.48, 0.48], [0.48, -0.06], ...arc(0.28, -0.06, 0.2, 0.14, 0, -160, 6)]] },
  i: { advance: 0.26, strokes: [[[0.12, 0.05], [0.12, 0.48]], [[0.12, 0.64], [0.12, 0.66]]] },
  n: { advance: 0.56, strokes: [[[0.09, 0.05], [0.09, 0.48]], [[0.09, 0.34], [0.18, 0.46], [0.34, 0.47], [0.45, 0.38], [0.45, 0.05]]] },
  p: { advance: 0.6, strokes: [arc(0.31, 0.26, 0.2, 0.22, 0, 360, 14), [[0.11, 0.48], [0.11, -0.2]]] }
};

const WORD_SPACE_EM = 0.26; // ~0.35 x cap height
/** Latin stroke width in em: bold 0.12 em (~0.17 x cap height), regular 0.09 em (~0.125 x cap). */
const STROKE_EM = { bold: 0.12, regular: 0.09 };
/** CJK strokes are a bit thinner than Latin ones at the same weight (more strokes per em). */
const CJK_STROKE_RATIO = 0.8;

// CJK-like glyphs: unit-square coordinates (u right, v DOWN), mapped into a 0.88 em square cell.
const HAND_CJK: Record<string, Pt[][]> = {
  // Rough 印: left 𠂉-ish part + right 卩
  印: [
    [[0.36, 0.04], [0.1, 0.14]],
    [[0.1, 0.14], [0.1, 0.9], [0.42, 0.8]],
    [[0.1, 0.46], [0.4, 0.46]],
    [[0.56, 0.1], [0.9, 0.1], [0.9, 0.62], [0.8, 0.58]],
    [[0.56, 0.1], [0.56, 0.98]]
  ],
  // Rough 刷: 尸 over 巾, plus 刂
  刷: [
    [[0.08, 0.1], [0.6, 0.1], [0.6, 0.3], [0.08, 0.3]],
    [[0.08, 0.1], [0.08, 0.55], [0.02, 0.95]],
    [[0.2, 0.48], [0.2, 0.86]],
    [[0.2, 0.48], [0.56, 0.48], [0.56, 0.8], [0.5, 0.78]],
    [[0.38, 0.38], [0.38, 1.0]],
    [[0.74, 0.18], [0.74, 0.7]],
    [[0.92, 0.04], [0.92, 0.96], [0.84, 0.9]]
  ]
};

/**
 * Seeded CJK-like glyph with 4-8 strokes, composed the way real ideographs are: a left-right
 * (radical + component), top-bottom, or single-component layout, where each component is a
 * 口/日-like enclosure, a 土/井-like lattice of horizontals and verticals, or a 大/木-like
 * cross with two falling strokes.
 */
function generateCjkStrokes(seed: number): Pt[][] {
  const rnd = mulberry32(seed * 2654435761);
  const jit = (a: number) => (rnd() - 0.5) * a;
  const strokes: Pt[][] = [];

  const component = (u0: number, u1: number, v0: number, v1: number) => {
    const w = u1 - u0, h = v1 - v0;
    const r = rnd();
    if (r < 0.4) {
      // 口 / 日: left side, top+right side, bottom, optional inner horizontal
      strokes.push([[u0, v0], [u0, v1]]);
      strokes.push([[u0, v0], [u1, v0], [u1, v1]]);
      strokes.push([[u0, v1], [u1, v1]]);
      if (rnd() < 0.6) strokes.push([[u0, v0 + h * 0.5], [u1, v0 + h * 0.5]]);
    } else if (r < 0.75) {
      // 土 / 王 / 井: 2-3 horizontals crossed by 1-2 verticals
      const nH = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < nH; i++) {
        const v = v0 + (h * i) / (nH - 1);
        const inset = (i === nH - 1 ? 0 : 0.12 + jit(0.1)) * w;
        strokes.push([[u0 + inset, v], [u1 - inset, v]]);
      }
      const nV = 1 + Math.floor(rnd() * 2);
      for (let k = 0; k < nV; k++) {
        const u = u0 + w * (nV === 1 ? 0.5 : 0.3 + 0.4 * k);
        strokes.push([[u, Math.max(0, v0 - 0.03)], [u, v1]]);
      }
    } else {
      // 大 / 木: one horizontal, one vertical, two falling strokes
      const vm = v0 + h * (0.3 + rnd() * 0.15);
      const um = (u0 + u1) / 2;
      strokes.push([[u0, vm], [u1, vm]]);
      strokes.push([[um, v0], [um, v1]]);
      strokes.push([[um, vm + 0.04], [u0 + w * 0.05, v1 - 0.02]]);
      strokes.push([[um, vm + 0.04], [u1 - w * 0.05, v1 - 0.02]]);
    }
  };

  const layout = rnd();
  if (layout < 0.45) {
    // Left-right: narrow radical (tall vertical + 1-2 short strokes) + right component
    const split = 0.34 + rnd() * 0.08;
    const lu = split * 0.5;
    strokes.push([[lu, 0.04], [lu, 0.97]]);
    strokes.push([[0.04, 0.3 + jit(0.1)], [split - 0.03, 0.26 + jit(0.1)]]);
    if (rnd() < 0.5) strokes.push([[0.06, 0.66], [split - 0.02, 0.56]]);
    component(split + 0.08, 0.96, 0.08, 0.94);
  } else if (layout < 0.8) {
    // Top-bottom
    component(0.14, 0.86, 0.04, 0.4);
    component(0.04, 0.96, 0.52, 0.97);
  } else {
    component(0.06, 0.94, 0.06, 0.96);
  }
  while (strokes.length > 8) strokes.pop();
  if (strokes.length < 4) strokes.push([[0.2, 0.3], [0.8, 0.3]]);
  return strokes;
}

interface TextSpec { text: string; x: number; baseline: number; size: number; bold: boolean; color: RGB }
interface InkStats {
  /** Tight bbox of "visible" ink (coverage >= 0.35), in the image it was drawn into. */
  bbox: Box;
  /** Mean coverage inside bbox (0..1) — real type is ~15-40 %, a filled box would be ~100 %. */
  inkFraction: number;
  /** Share of inked pixels that are only partially covered — > 0 means anti-aliased edges. */
  softEdgeFraction: number;
}

/**
 * Draws one line of text with analytic anti-aliasing (coverage = clamp(hw + 0.5 - dist, 0, 1),
 * union by max) and colour-blends it onto `img`. Returns the ink statistics used as ground truth.
 */
function drawText(img: ImageData, spec: TextSpec): InkStats {
  const { width: W, height: H, data: d } = img;
  const { size, baseline } = spec;
  const latinHw = ((spec.bold ? STROKE_EM.bold : STROKE_EM.regular) * size) / 2;
  const cjkHw = latinHw * CJK_STROKE_RATIO;
  const segs: number[] = []; // ax, ay, bx, by, hw

  const addPoly = (pts: Pt[], hw: number) => {
    for (let k = 0; k + 1 < pts.length; k++) segs.push(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], hw);
  };

  let pen = spec.x;
  for (const ch of spec.text) {
    if (ch === ' ') { pen += WORD_SPACE_EM * size; continue; }
    const g = LATIN[ch];
    if (g) {
      const penX = pen;
      for (const poly of g.strokes) addPoly(poly.map(([gx, gy]): Pt => [penX + gx * size, baseline - gy * size]), latinHw);
      pen += g.advance * size;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x2e80) throw new Error(`procedural font has no glyph for "${ch}"`);
    const penX = pen;
    const strokes = HAND_CJK[ch] ?? generateCjkStrokes(code);
    for (const poly of strokes) {
      addPoly(poly.map(([u, v]): Pt => [penX + (0.06 + u * 0.88) * size, baseline - (0.8 - v * 0.86) * size]), cjkHw);
    }
    pen += size;
  }

  // Coverage layer over the union of stroke bounding boxes.
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let s = 0; s < segs.length; s += 5) {
    const hw = segs[s + 4] + 2;
    bx0 = Math.min(bx0, segs[s] - hw, segs[s + 2] - hw);
    bx1 = Math.max(bx1, segs[s] + hw, segs[s + 2] + hw);
    by0 = Math.min(by0, segs[s + 1] - hw, segs[s + 3] - hw);
    by1 = Math.max(by1, segs[s + 1] + hw, segs[s + 3] + hw);
  }
  const ox = clamp(Math.floor(bx0), 0, W - 1), oy = clamp(Math.floor(by0), 0, H - 1);
  const cw = clamp(Math.ceil(bx1), 0, W) - ox, chh = clamp(Math.ceil(by1), 0, H) - oy;
  const cov = new Float32Array(cw * chh);

  for (let s = 0; s < segs.length; s += 5) {
    const ax = segs[s], ay = segs[s + 1], bx = segs[s + 2], by = segs[s + 3], hw = segs[s + 4];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const xa = clamp(Math.floor(Math.min(ax, bx) - hw - 1), ox, ox + cw - 1);
    const xb = clamp(Math.ceil(Math.max(ax, bx) + hw + 1), ox, ox + cw - 1);
    const ya = clamp(Math.floor(Math.min(ay, by) - hw - 1), oy, oy + chh - 1);
    const yb = clamp(Math.ceil(Math.max(ay, by) + hw + 1), oy, oy + chh - 1);
    for (let py = ya; py <= yb; py++) {
      const cy = py + 0.5;
      for (let px = xa; px <= xb; px++) {
        const cx = px + 0.5;
        const t = len2 > 0 ? clamp(((cx - ax) * dx + (cy - ay) * dy) / len2, 0, 1) : 0;
        const ex = ax + t * dx - cx, ey = ay + t * dy - cy;
        const c = hw + 0.5 - Math.sqrt(ex * ex + ey * ey);
        if (c <= 0) continue;
        const k = (py - oy) * cw + (px - ox);
        const v = c > 1 ? 1 : c;
        if (v > cov[k]) cov[k] = v;
      }
    }
  }

  // Blend + ground-truth statistics.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let inked = 0, soft = 0;
  for (let y = 0; y < chh; y++) {
    for (let x = 0; x < cw; x++) {
      const c = cov[y * cw + x];
      if (c <= 0) continue;
      const i = ((oy + y) * W + (ox + x)) * 4;
      d[i] = d[i] + (spec.color[0] - d[i]) * c;
      d[i + 1] = d[i + 1] + (spec.color[1] - d[i + 1]) * c;
      d[i + 2] = d[i + 2] + (spec.color[2] - d[i + 2]) * c;
      if (c > 0.05) { inked++; if (c < 0.95) soft++; }
      if (c >= 0.35) {
        if (ox + x < minX) minX = ox + x;
        if (ox + x > maxX) maxX = ox + x;
        if (oy + y < minY) minY = oy + y;
        if (oy + y > maxY) maxY = oy + y;
      }
    }
  }
  const bbox: Box = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  let inkSum = 0;
  for (let y = bbox.y; y < bbox.y + bbox.height; y++) {
    for (let x = bbox.x; x < bbox.x + bbox.width; x++) inkSum += cov[(y - oy) * cw + (x - ox)];
  }
  return { bbox, inkFraction: inkSum / (bbox.width * bbox.height), softEdgeFraction: inked > 0 ? soft / inked : 0 };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Scenes
// ───────────────────────────────────────────────────────────────────────────────────────────────

interface Scene {
  img: ImageData;
  /** Ground-truth ink bbox of each text line, in `img` coordinates. */
  lines: Box[];
  /** Rasterizer statistics per line (in the frame the text was drawn in). */
  inks: InkStats[];
}

const BUG_GRADIENT: ReadonlyArray<readonly [number, RGB]> = [[0, hex('#1a2a6c')], [0.5, hex('#b21f1f')], [1, hex('#fdbb2d')]];
/** Muted mid/dark photo tones (luminance ~50-120): [0] = top, [1] = bottom of the base blend. */
const PHOTO_PALETTE: readonly RGB[] = ['#4d5a72', '#3f4a35', '#56644a', '#7a6c58', '#2e3b55', '#8b7b67', '#6b5a4a'].map(hex);
const DARK_INK = hex('#1d1d1f');

type SceneId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'N1' | 'N2' | 'N3' | 'N4'
  | 'RP1' | 'RP2' | 'RN1' | 'RN2' | 'RN3' | 'RN4' | 'RN5' | 'RN6' | 'RN7';

// Repeating patterns and textures (regression cases for the periodicity, module-grid and round-outline
// rejectors of locateTextRegions; the same shapes as the throwaway benchmark's probes).
const SKY: ReadonlyArray<readonly [number, RGB]> = [[0, hex('#87ceeb')], [1, hex('#e0f0ff')]];
const PROBE_DARK = hex('#202020');
function flat(c: RGB): ImageData {
  const img = makeImage(1200, 800);
  fillFlat(img, c);
  return img;
}
/** Running-bond brick wall: 56x20 bricks on a 60x24 grid, rows offset by half a brick. */
function brickWall(img: ImageData, y0: number, y1: number): void {
  fillRectAA(img, 0, y0, img.width, y1, hex('#d9d2c5'));
  let row = 0;
  for (let y = y0; y < y1; y += 24, row++) {
    for (let x = (row % 2) * -30; x < img.width; x += 60) fillRectAA(img, Math.max(0, x + 2), y + 2, Math.min(img.width, x + 58), y + 22, hex('#9c4a32'));
  }
}
/** Building facade: a grid of 14x18 dark windows on a 24x28 pitch. */
function facade(img: ImageData, y0: number, y1: number): void {
  for (let y = y0; y < y1; y += 28) for (let x = 20; x < img.width - 20; x += 24) fillRectAA(img, x, y + 4, x + 14, y + 22, hex('#2a3440'));
}

const BUILDERS: Record<SceneId, () => Scene> = {
  // P1 — the reproduction. The original 1200x800 canvas: diagonal gradient, white bold 90px
  // "Hello 印刷" at (200, 420), then the app's upscale + bleed + sharpen -> 1740x1172. After the
  // upscale the em is ~128 px (cap height ~92 px) and the line spans ~34 % of the width.
  P1: () => {
    const src = makeImage(1200, 800);
    fillLinearGradient(src, BUG_GRADIENT, [0, 0], [1200, 800]);
    const ink = drawText(src, { text: 'Hello 印刷', x: 200, baseline: 420, size: 90, bold: true, color: WHITE });
    return { img: printPipeline(src), lines: [pipelineBox(ink.bbox, 1200, 800)], inks: [ink] };
  },
  // P2 — same text, small dark caption (16px font) on a light flat background, 1200x800.
  P2: () => {
    const img = makeImage(1200, 800);
    fillFlat(img, hex('#f4f1ea'));
    const ink = drawText(img, { text: 'Hello 印刷', x: 60, baseline: 760, size: 16, bold: false, color: hex('#222222') });
    return { img, lines: [ink.bbox], inks: [ink] };
  },
  // P3 — a line of five CJK-like glyphs (~64px font, ~56 px cells) in white on a photo-like background.
  P3: () => {
    const img = makeImage(1200, 800);
    fillPhotoLike(img, 7, PHOTO_PALETTE, 2.5);
    const ink = drawText(img, { text: '春夏秋冬雪', x: 380, baseline: 330, size: 64, bold: false, color: hex('#fbfbf8') });
    blur121(img);
    return { img, lines: [ink.bbox], inks: [ink] };
  },
  // P4 — title (80px bold) + subtitle (30px regular), ~48 px clear gap between the ink boxes.
  P4: () => {
    const img = makeImage(1200, 800);
    fillLinearGradient(img, [[0, hex('#fbf6ee')], [1, hex('#efe3d0')]], [0, 0], [0, 800]);
    const title = drawText(img, { text: 'GRAND OPENING', x: 120, baseline: 330, size: 80, bold: true, color: DARK_INK });
    const sub = drawText(img, { text: 'Summer Sale', x: 124, baseline: 402, size: 30, bold: false, color: DARK_INK });
    blur121(img);
    return { img, lines: [title.bbox, sub.bbox], inks: [title, sub] };
  },
  // P5 — narrow short word (~12 % of the width) near the right edge, white bold on a dark gradient.
  P5: () => {
    const img = makeImage(1200, 800);
    fillLinearGradient(img, [[0, hex('#2b5876')], [1, hex('#4e4376')]], [0, 0], [1200, 0]);
    const ink = drawText(img, { text: 'SALE', x: 1016, baseline: 150, size: 56, bold: true, color: WHITE });
    blur121(img);
    return { img, lines: [ink.bbox], inks: [ink] };
  },
  // N1 — P1's background alone, through the same pipeline.
  N1: () => {
    const src = makeImage(1200, 800);
    fillLinearGradient(src, BUG_GRADIENT, [0, 0], [1200, 800]);
    return { img: printPipeline(src), lines: [], inks: [] };
  },
  // N2 — photo-like background, no text, 1740x1170.
  N2: () => {
    const img = makeImage(1740, 1170);
    fillPhotoLike(img, 11, PHOTO_PALETTE, 2.5);
    return { img, lines: [], inks: [] };
  },
  // N3 — one large solid dark rectangle (60 % x 40 %) with anti-aliased edges on a light background.
  N3: () => {
    const img = makeImage(1200, 800);
    fillFlat(img, hex('#f2f2f2'));
    fillRectAA(img, 240.4, 240.6, 960.4, 560.6, hex('#202020'));
    blur121(img);
    return { img, lines: [], inks: [] };
  },
  // N4 — flat colour.
  N4: () => {
    const img = makeImage(1200, 800);
    fillFlat(img, hex('#d8d0c0'));
    return { img, lines: [], inks: [] };
  },
  // RP1 — white 70px bold title across a brick wall that fills the image: the band is cut back to the
  // title instead of being dropped as a repeating pattern.
  RP1: () => {
    const img = makeImage(1200, 800);
    brickWall(img, 0, 800);
    const ink = drawText(img, { text: 'Summer Garden', x: 200, baseline: 400, size: 70, bold: true, color: WHITE });
    blur121(img);
    return { img, lines: [ink.bbox], inks: [ink] };
  },
  // RP2 — dark 30px bold title on the sky above a brick wall in the bottom 35 %.
  RP2: () => {
    const img = makeImage(1200, 800);
    fillLinearGradient(img, SKY, [0, 0], [0, 800]);
    brickWall(img, 520, 800);
    const ink = drawText(img, { text: 'Grand Opening Sale', x: 100, baseline: 150, size: 30, bold: true, color: DARK_INK });
    blur121(img);
    return { img, lines: [ink.bbox], inks: [ink] };
  },
  // RN1 — building facade window grid in the bottom 30 % under a sky.
  RN1: () => {
    const img = makeImage(1200, 800);
    fillLinearGradient(img, SKY, [0, 0], [0, 800]);
    fillRectAA(img, 0, 560, 1200, 800, hex('#8a939c'));
    facade(img, 560, 800);
    blur121(img);
    return { img, lines: [], inks: [] };
  },
  // RN2 — brick wall in the bottom 30 % under a sky.
  RN2: () => {
    const img = makeImage(1200, 800);
    fillLinearGradient(img, SKY, [0, 0], [0, 800]);
    brickWall(img, 560, 800);
    blur121(img);
    return { img, lines: [], inks: [] };
  },
  // RN3 — 60 px light tiles with 4 px grey grout over the whole image.
  RN3: () => {
    const img = flat(hex('#9a9a9a'));
    for (let y = 0; y < 800; y += 64) for (let x = 0; x < 1200; x += 64) fillRectAA(img, x + 2, y + 2, Math.min(1200, x + 62), Math.min(800, y + 62), hex('#f4f4f4'));
    blur121(img);
    return { img, lines: [], inks: [] };
  },
  // RN4 — staggered polka dots (r 12 px on a 48 px pitch) over the whole image.
  RN4: () => {
    const img = flat(hex('#f7e1e6'));
    for (let y = 24; y < 800; y += 48) for (let x = 24 + ((y / 48) % 2) * 24; x < 1200; x += 48) fillDisc(img, x, y, 12, hex('#c2185b'));
    return { img, lines: [], inks: [] };
  },
  // RN5 — 50 thin bubble outlines (r 10-50 px, 2 px rings) scattered over a blue background.
  RN5: () => {
    const img = flat(hex('#3a7bd5'));
    const rnd = mulberry32(74);
    for (let k = 0; k < 50; k++) {
      const r = 10 + rnd() * 40;
      fillRing(img, rnd() * 1200, rnd() * 800, r, r - 2, [230, 245, 255]);
    }
    blur121(img);
    return { img, lines: [], inks: [] };
  },
  // RN6 — coupon: a dashed 3 px border (14 px dashes on a 24 px pitch) around an empty card.
  RN6: () => {
    const img = flat(hex('#fff8e1'));
    for (let x = 40; x < 1160; x += 24) {
      fillRectAA(img, x, 40, x + 14, 43, PROBE_DARK);
      fillRectAA(img, x, 757, x + 14, 760, PROBE_DARK);
    }
    for (let y = 40; y < 760; y += 24) {
      fillRectAA(img, 40, y, 43, y + 14, PROBE_DARK);
      fillRectAA(img, 1157, y, 1160, y + 14, PROBE_DARK);
    }
    blur121(img);
    return { img, lines: [], inks: [] };
  },
  // RN7 — a row of five 64 px round icons (dark disc, white square / triangle / ring inside) on a
  // 90 px pitch: the outlines repeat, the inner symbols do not.
  RN7: () => {
    const img = flat(hex('#ffffff'));
    for (let k = 0; k < 5; k++) {
      const cx = 420 + k * 90;
      const cy = 700;
      fillDisc(img, cx, cy, 32, hex('#333333'));
      if (k % 3 === 0) fillRectAA(img, cx - 12, cy - 12, cx + 12, cy + 12, WHITE);
      else if (k % 3 === 1) fillPoly(img, [[cx - 14, cy + 12], [cx + 14, cy + 12], [cx, cy - 14]], WHITE);
      else fillRing(img, cx, cy, 16, 10, WHITE);
    }
    blur121(img);
    return { img, lines: [], inks: [] };
  }
};

const sceneCache = new Map<SceneId, Scene>();
function scene(id: SceneId): Scene {
  let s = sceneCache.get(id);
  if (!s) {
    s = BUILDERS[id]();
    sceneCache.set(id, s);
  }
  return s;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Matching helpers
// ───────────────────────────────────────────────────────────────────────────────────────────────

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Region covers >= 80 % of the line's ink bbox and is at most 2.5x as tall as the line. */
function coversLine(r: Box, line: Box): boolean {
  return overlapArea(r, line) >= 0.8 * line.width * line.height && r.height <= 2.5 * line.height;
}

const fmtBox = (b: Box) => `[x=${Math.round(b.x)} y=${Math.round(b.y)} w=${Math.round(b.width)} h=${Math.round(b.height)}]`;
const fmtRegions = (rs: Box[]) => (rs.length === 0 ? 'no regions' : `${rs.length} region(s): ${rs.map(fmtBox).join(', ')}`);

/** Fraction of pixels inside `b` whose 1-px luminance gradient (|dx| + |dy|) exceeds `thr`. */
function hardEdgeFraction(img: ImageData, b: Box, thr = 38): number {
  const { width: w, height: h, data: d } = img;
  let n = 0, hit = 0;
  const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y));
  const x1 = Math.min(w - 2, Math.ceil(b.x + b.width)), y1 = Math.min(h - 2, Math.ceil(b.y + b.height));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      const l = lumaAt(d, i);
      const g = Math.abs(l - lumaAt(d, i + 4)) + Math.abs(l - lumaAt(d, i + w * 4));
      n++;
      if (g > thr) hit++;
    }
  }
  return n > 0 ? hit / n : 0;
}

async function detect(img: ImageData): Promise<Box[]> {
  const regions = await TextInspector.detectTextRegions(img);
  return regions.map(({ x, y, width, height }) => ({ x, y, width, height }));
}

/** Shared positive-case assertion: every line found by its own region, and no stray regions. */
async function expectLinesFound(id: SceneId): Promise<void> {
  const { img, lines } = scene(id);
  const regions = await detect(img);
  const ctx = `${id} (${img.width}x${img.height}); truth ${lines.map(fmtBox).join(', ')}; got ${fmtRegions(regions)}`;
  // One line per scenario so the benchmark output shows region quality even when a case passes.
  // eslint-disable-next-line no-console
  console.log(`[text-region-detection] ${ctx}`);

  const used = new Set<number>();
  lines.forEach((line, li) => {
    const idx = regions.findIndex((r, ri) => !used.has(ri) && coversLine(r, line));
    expect(idx, `${ctx} — line ${li + 1} ${fmtBox(line)} has no region covering >= 80 % of it with height <= ${Math.round(2.5 * line.height)}px`).toBeGreaterThanOrEqual(0);
    used.add(idx);
  });

  const stray = regions.filter((r) => !lines.some((line) => overlapArea(r, line) > 0));
  expect(stray.length, `${ctx} — ${stray.length} region(s) lie entirely off the text: ${stray.map(fmtBox).join(', ')}`).toBe(0);
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────────────────────────────────────

describe('TextInspector.detectTextRegions — realistic region-localization benchmark', () => {
  beforeEach(() => {
    mockRecognizeRegion.mockReset();
    mockImageDataToCanvas.mockReset();
    mockImageDataToCanvas.mockReturnValue({} as any);
    mockRecognizeRegion.mockResolvedValue(null);
  });

  describe('procedural rasterizer sanity (ground truth looks like real type, not dither)', () => {
    const POSITIVES: SceneId[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

    it('ink coverage inside every text bbox is 10-45 % and glyph edges are anti-aliased', () => {
      for (const id of POSITIVES) {
        scene(id).inks.forEach((ink, li) => {
          const tag = `${id} line ${li + 1}: inkFraction=${ink.inkFraction.toFixed(3)} softEdge=${ink.softEdgeFraction.toFixed(3)}`;
          expect(ink.inkFraction, tag).toBeGreaterThanOrEqual(0.1);
          expect(ink.inkFraction, tag).toBeLessThanOrEqual(0.45);
          expect(ink.softEdgeFraction, tag).toBeGreaterThan(0.05);
        });
      }
    });

    it('hard 1-px edges are sparse inside large text, unlike the dither bands of the legacy tests', () => {
      // The legacy fixture from tests/text-inspector.test.ts: a (x + y) % 4 dither band.
      const dither = makeImage(400, 300);
      fillFlat(dither, hex('#f0f0f0'));
      for (let y = 50; y < 80; y++) {
        for (let x = 60; x < 340; x++) {
          if ((x + y) % 4 === 0) {
            const i = (y * 400 + x) * 4;
            dither.data[i] = 10; dither.data[i + 1] = 10; dither.data[i + 2] = 10;
          }
        }
      }
      const ditherFrac = hardEdgeFraction(dither, { x: 60, y: 50, width: 280, height: 30 });
      expect(ditherFrac).toBeGreaterThan(0.4); // exactly half of all pixels are hard edges

      // Only large text is checked: at 16-30px (P2, P4 subtitle) the 1-2 px strokes are nearly all
      // edge, which is also true of real small type.
      const large: Array<[SceneId, number]> = [['P1', 0], ['P3', 0], ['P4', 0], ['P5', 0]];
      for (const [id, li] of large) {
        const s = scene(id);
        const frac = hardEdgeFraction(s.img, s.lines[li]);
        expect(frac, `${id} line ${li + 1}: hard-edge fraction ${frac.toFixed(3)} (dither ${ditherFrac.toFixed(3)})`).toBeLessThan(0.35);
      }
    });

    it('P1 matches the bug report geometry (~1740x1170, line spans 25-35 % of the width, vertically central)', () => {
      const { img, lines } = scene('P1');
      expect(img.width).toBe(1740);
      expect(img.height).toBe(1172);
      const line = lines[0];
      const span = line.width / img.width;
      expect(span, `span ${span.toFixed(3)}`).toBeGreaterThanOrEqual(0.25);
      expect(span, `span ${span.toFixed(3)}`).toBeLessThanOrEqual(0.35);
      expect(line.height).toBeGreaterThan(100);
      expect(line.height).toBeLessThan(135);
      const centreY = (line.y + line.height / 2) / img.height;
      expect(centreY).toBeGreaterThan(0.35);
      expect(centreY).toBeLessThan(0.65);
      // Left-ish, as drawn at x=200 of 1200 in the bug report.
      expect(line.x / img.width).toBeLessThan(0.3);
    });

    it('text-free backgrounds carry (almost) no hard 1-px edges of their own', () => {
      for (const id of ['N1', 'N2', 'N4'] as SceneId[]) {
        const { img } = scene(id);
        const frac = hardEdgeFraction(img, { x: 0, y: 0, width: img.width, height: img.height });
        expect(frac, `${id} hard-edge fraction ${frac}`).toBeLessThan(0.001);
      }
    });
  });

  describe('positives — the text line must be localized', () => {
    it('P1 bug reproduction: white bold "Hello 印刷" on a diagonal gradient, upscaled 1.42x + bleed + sharpen (1740x1172)', async () => {
      await expectLinesFound('P1');
    });

    it('P2 small dark 16px caption "Hello 印刷" on a light flat 1200x800 background', async () => {
      await expectLinesFound('P2');
    });

    it('P3 line of five CJK-like glyphs (~64px) in white on a photo-like 1200x800 background', async () => {
      await expectLinesFound('P3');
    });

    it('P4 title (80px bold) + subtitle (30px) clearly separated -> two distinct regions, one per line', async () => {
      await expectLinesFound('P4');
    });

    it('P5 narrow short word "SALE" (~12 % of width) near the right edge', async () => {
      await expectLinesFound('P5');
    });
  });

  describe('negatives — no text, so zero regions (each false region costs an OCR call)', () => {
    const cases: Array<[SceneId, string]> = [
      ['N1', 'smooth multi-stop gradient only, through the upscale/bleed/sharpen pipeline (1740x1172)'],
      ['N2', 'photo-like background with soft shapes and mild noise (1740x1170)'],
      ['N3', 'large solid dark rectangle (60 % x 40 %) on a light background'],
      ['N4', 'flat colour']
    ];
    for (const [id, label] of cases) {
      it(`${id} ${label}`, async () => {
        const { img } = scene(id);
        const regions = await detect(img);
        const ctx = `${id} (${img.width}x${img.height}): expected no regions, got ${fmtRegions(regions)}`;
        // eslint-disable-next-line no-console
        console.log(`[text-region-detection] ${ctx}`);
        expect(regions.length, ctx).toBe(0);
      });
    }
  });

  describe('repeating patterns and textures — rejected as a whole, but text lying on them is kept', () => {
    it('RP1 white 70px title across a brick wall that fills the image', async () => {
      await expectLinesFound('RP1');
    });

    it('RP2 dark 30px title on the sky above a brick wall (bottom 35 %)', async () => {
      await expectLinesFound('RP2');
    });

    const cases: Array<[SceneId, string]> = [
      ['RN1', 'building facade window grid (bottom 30 %) under a sky'],
      ['RN2', 'brick wall (bottom 30 %) under a sky'],
      ['RN3', 'tile grid with grout over the whole image'],
      ['RN4', 'staggered polka dots over the whole image'],
      ['RN5', 'scattered thin bubble rings'],
      ['RN6', 'dashed coupon border around an empty card'],
      ['RN7', 'row of five round icons with different inner symbols']
    ];
    for (const [id, label] of cases) {
      it(`${id} ${label} -> zero regions`, async () => {
        const { img } = scene(id);
        const regions = await detect(img);
        const ctx = `${id} (${img.width}x${img.height}): expected no regions, got ${fmtRegions(regions)}`;
        // eslint-disable-next-line no-console
        console.log(`[text-region-detection] ${ctx}`);
        expect(regions.length, ctx).toBe(0);
      });
    }
  });

  describe('performance', () => {
    it('PERF 6000x4000 photo-like image with one text line: localization stays under 600 ms', async () => {
      const img = makeImage(6000, 4000);
      fillPhotoLike(img, 23, PHOTO_PALETTE, 2.5);
      const ink = drawText(img, { text: 'Hello 印刷', x: 900, baseline: 2200, size: 360, bold: true, color: WHITE });

      const t0 = performance.now();
      const regions = await detect(img);
      const ms = performance.now() - t0;

      const found = regions.some((r) => coversLine(r, ink.bbox));
      // eslint-disable-next-line no-console
      console.log(
        `[text-region-detection] PERF 6000x4000: detectTextRegions (OCR mocked) took ${ms.toFixed(1)} ms; ` +
          `truth ${fmtBox(ink.bbox)}; ${fmtRegions(regions)}; line localized: ${found}`
      );
      // Runs on the main thread after every processed image; ~150-250 ms is typical, 600 ms leaves CI room.
      expect(ms).toBeLessThan(600);
    });
  });
});
