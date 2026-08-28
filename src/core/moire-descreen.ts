/**
 * 🌀 FFT Moiré/Screen-Pattern Descreen Filter
 *
 * Real algorithm, ported from `6o6o/fft-descreen` (Bogdan Boyko, 2019, MIT License — verified
 * 2026-08-28 directly against the repo's own `LICENSE` file, standard unmodified text, no added
 * clauses). That project is itself a from-scratch Python/OpenCV re-implementation of the GIMP
 * "descreen" plugin's frequency-domain approach (see its README), not a machine-learning model —
 * there are no trained weights anywhere in this pipeline, it's pure signal processing.
 *
 * What it actually does: takes the 2D FFT of each color channel, builds a mask that flags
 * frequency-domain "spikes" (periodic patterns — halftone screens, LCD sub-pixel grids, etc.)
 * using a custom magnitude-spectrum normalization that weights energy by distance from DC (so a
 * simple fixed threshold can localize spikes without per-image tuning), protects a central
 * "middle" ellipse of low frequencies (the actual image content) from ever being touched, dilates
 * and blurs the mask so the cut is soft rather than a hard notch (avoiding ringing), then inverse-
 * transforms the attenuated spectrum back to pixels.
 *
 * ⚠️ Real, honest limitations of this TypeScript port vs. the original:
 * - OpenCV's `cv2.dft`/`idft` support arbitrary-size 2D FFT (mixed-radix). This port only
 *   implements a radix-2 Cooley-Tukey FFT, which requires power-of-2 dimensions — so the source
 *   image is reflect-padded up to the next power-of-2 width/height before transforming, and
 *   cropped back afterward. This changes the exact frequency bins the algorithm computes (a
 *   1200×1600 image is padded to 2048×2048, not processed at its native size), which the original
 *   never does. The core spike-detection/masking logic is otherwise a faithful port of the same
 *   math (same `normalize()`/`ellipse()`/threshold/dilate/blur pipeline, same default parameters).
 * - The Gaussian blur kernel radius uses a standard `ceil(3*sigma)` half-width rather than
 *   OpenCV's exact internal auto-kernel-size formula — visually equivalent, not bit-identical.
 * - Designed for "翻拍印刷品/掃描文件的網點摩爾紋" (photographing/scanning printed halftone
 *   screens), which is genuinely a different degradation from "photographing an LCD/OLED screen"
 *   (a separate problem — no open-source model was found for print halftone at all, see
 *   docs/SPEC.md; that gap is exactly why this classical filter was chosen over a neural model).
 *   It will do very little for photographed-a-screen moiré, and can slightly blur very fine real
 *   detail if run on an image that has no periodic pattern at all — this is why the UI keeps it as
 *   an opt-in tool, not an always-on pipeline step.
 */

import { createImageData } from './image-data-factory';

export interface DescreenOptions {
  /** Threshold level for the normalized log-magnitude spectrum. Matches the original's `--thresh` (default 92). */
  threshold?: number;
  /** Radius to expand (dilate) and soften the detected spike mask. Matches `--radius` (default 6). */
  radius?: number;
  /** Ratio for the protected low-frequency "middle" region — larger = more of the spectrum center is protected. Matches `--middle` (default 4). */
  middle?: number;
}

const DEFAULT_THRESHOLD = 92;
const DEFAULT_RADIUS = 6;
const DEFAULT_MIDDLE = 4;

// Real photos can be large; an FFT-based filter is O(N log N) per channel but with a real
// constant-factor cost driven by the PADDED (next power-of-2) working size, not the raw pixel
// count — every source between roughly 1025 and 2048 per side pads to the same 2048x2048 working
// array and costs the same ~7s (measured on a 1200x1200 input in this app's Node test env). So
// this cap is set just under that 2048 boundary rather than at some arbitrary lower megapixel
// figure — anything larger crosses into the 4096x4096 bucket, which measured roughly 4x slower
// (~30s), too slow for a manually-triggered browser tool. Matches the pattern used elsewhere in
// this app (server.py's MAX_INPUT_PIXELS) for capping expensive per-pixel operations.
export const MAX_DESCREEN_INPUT_PIXELS = 2000 * 2000;

export class MoireDescreen {
  public static apply(source: ImageData, options: DescreenOptions = {}): ImageData {
    const threshold = options.threshold ?? DEFAULT_THRESHOLD;
    const radius = Math.max(1, Math.round(options.radius ?? DEFAULT_RADIUS));
    const middleRatio = Math.max(1, Math.round(options.middle ?? DEFAULT_MIDDLE));

    const { width: srcW, height: srcH, data: srcData } = source;
    if (srcW * srcH > MAX_DESCREEN_INPUT_PIXELS) {
      throw new Error(
        `圖片過大（${srcW}x${srcH} = ${((srcW * srcH) / 1e6).toFixed(1)}MP，上限 ${(MAX_DESCREEN_INPUT_PIXELS / 1e6).toFixed(1)}MP），去網紋運算量過高，請先縮小圖片。`
      );
    }

    const padW = nextPow2(srcW);
    const padH = nextPow2(srcH);

    // The spike mask is built once (from the red channel's spectrum geometry — the coefs/ellipse
    // shapes only depend on padW/padH, not pixel content) but the threshold decision itself is
    // per-channel, matching the original's per-channel loop exactly (each color channel gets its
    // own independently-computed mask, since a screen pattern's exact frequency signature can
    // differ slightly per channel due to CFA/print-process color separation).
    const coefs = buildDistanceCoefs(padW, padH);
    const middleMask = buildMiddleMask(padW, padH, middleRatio);

    const outData = new Uint8ClampedArray(srcData.length);
    // Alpha passes through unchanged — this filter only touches color.
    for (let i = 3; i < srcData.length; i += 4) outData[i] = srcData[i];

    for (let channel = 0; channel < 3; channel++) {
      const plane = extractChannel(srcData, srcW, srcH, channel);
      const padded = reflectPad(plane, srcW, srcH, padW, padH);

      const re = padded;
      const im = new Float64Array(padW * padH);

      fft2d(re, im, padW, padH, false);
      fftshift2d(re, im, padW, padH);

      const spectrum = new Float64Array(padW * padH);
      for (let idx = 0; idx < spectrum.length; idx++) {
        const mag = Math.hypot(re[idx], im[idx]);
        spectrum[idx] = 20 * Math.log(Math.max(mag * coefs[idx], 1e-6));
      }

      let mask: Float64Array = new Float64Array(padW * padH);
      for (let idx = 0; idx < mask.length; idx++) {
        mask[idx] = spectrum[idx] > threshold ? 255 : 0;
      }
      for (let idx = 0; idx < mask.length; idx++) {
        mask[idx] *= 1 - middleMask[idx];
      }
      mask = grayscaleDilate(mask, padW, padH, radius);
      mask = gaussianBlur(mask, padW, padH, radius / 3);
      for (let idx = 0; idx < mask.length; idx++) {
        mask[idx] = 1 - mask[idx] / 255;
      }

      for (let idx = 0; idx < re.length; idx++) {
        re[idx] *= mask[idx];
        im[idx] *= mask[idx];
      }

      fftshift2d(re, im, padW, padH); // ifftshift == fftshift for even dimensions
      fft2d(re, im, padW, padH, true);

      // Original takes cv2.magnitude() of the inverse result rather than just the real part —
      // replicated here so tiny numerical imaginary residue can't leave a phase-dependent bias.
      for (let idx = 0; idx < re.length; idx++) {
        re[idx] = Math.hypot(re[idx], im[idx]);
      }

      writeChannelFromPadded(outData, re, srcW, srcH, padW, padH, channel);
    }

    // 2026-08-29: this used to always build a plain object here, never a real `ImageData`
    // instance. Real bug: the main-thread Worker-fallback path (worker-client.ts's
    // runMainThreadFallback 'descreen' case, used when Web Workers are unavailable or crash)
    // returned this result directly into main.ts's `imageDataToDataUrl()`, which calls
    // `ctx.putImageData()` — verified empirically in a real browser that `putImageData()` throws
    // TypeError on a plain object (it does a WebIDL brand check, not duck typing). Fixed by using
    // the shared factory, which produces a real ImageData when the constructor is available.
    return createImageData(outData, srcW, srcH);
  }
}

// ─── Small helpers ──────────────────────────────────────────────────────────────────────────
// nextPow2/extractChannel/reflectPad/fft2d/fftshift2d are also reused by moire-risk-predictor.ts
// (real periodicity detection for moiré-risk preflight) — exported rather than duplicated.

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function extractChannel(data: Uint8ClampedArray, w: number, h: number, channel: number): Float64Array {
  const out = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = data[i * 4 + channel];
  return out;
}

/** Reflect-pads a (srcW x srcH) plane into a (padW x padH) buffer, source anchored at (0,0). */
export function reflectPad(src: Float64Array, srcW: number, srcH: number, padW: number, padH: number): Float64Array {
  if (srcW === padW && srcH === padH) {
    // Still need a fresh, appropriately-sized buffer since this becomes the in-place FFT buffer.
    const out = new Float64Array(padW * padH);
    out.set(src);
    return out;
  }
  const out = new Float64Array(padW * padH);
  for (let y = 0; y < padH; y++) {
    const sy = reflectIndex(y, srcH);
    for (let x = 0; x < padW; x++) {
      const sx = reflectIndex(x, srcW);
      out[y * padW + x] = src[sy * srcW + sx];
    }
  }
  return out;
}

function reflectIndex(i: number, n: number): number {
  if (n === 1) return 0;
  const period = 2 * (n - 1);
  let m = i % period;
  if (m < 0) m += period;
  return m < n ? m : period - m;
}

/** Crops the padded plane back to the source dimensions and writes it into the RGBA output at the given channel. */
function writeChannelFromPadded(
  out: Uint8ClampedArray,
  padded: Float64Array,
  srcW: number,
  srcH: number,
  padW: number,
  _padH: number,
  channel: number
): void {
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      out[(y * srcW + x) * 4 + channel] = padded[y * padW + x];
    }
  }
}

// ─── Distance-weighted spectrum normalization + protected-middle ellipse ──────────────────────
// Faithful port of the original's `normalize(h, w)` and `ellipse(w, h)` / `middle` construction.

function buildDistanceCoefs(w: number, h: number): Float64Array {
  const cx = new Float64Array(w);
  for (let x = 0; x < w; x++) cx[x] = Math.abs(x - (w >> 1)) ** 0.5;
  const cy = new Float64Array(h);
  for (let y = 0; y < h; y++) cy[y] = Math.abs(y - (h >> 1)) ** 0.5;

  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const energy = cx[x] + cy[y];
      out[y * w + x] = Math.max(energy * energy, 0.01);
    }
  }
  return out;
}

/** Real-valued elliptical structuring element, 0/1, sized (2h+1) x (2w+1) — matches `ellipse()`. */
function ellipseKernel(w: number, h: number): Uint8Array {
  const kw = 2 * w + 1;
  const kh = 2 * h + 1;
  const offset = (w + h) / 2 / (w * h);
  const out = new Uint8Array(kw * kh);
  for (let j = 0; j <= 2 * h; j++) {
    const y = j - h;
    for (let i = 0; i <= 2 * w; i++) {
      const x = i - w;
      const v = (x / w) ** 2 + (y / h) ** 2 - offset;
      out[j * kw + i] = v <= 1 ? 1 : 0;
    }
  }
  return out;
}

/** Builds the padded-size 0/1 mask of the centered "protect this from touching" ellipse region. */
function buildMiddleMask(padW: number, padH: number, middleRatio: number): Float64Array {
  const mid = middleRatio * 2;
  const ew = Math.floor(padW / mid);
  const eh = Math.floor(padH / mid);
  const kernel = ellipseKernel(ew, eh); // (2*ew+1) x (2*eh+1)
  const kw = 2 * ew + 1;
  const kh = 2 * eh + 1;
  const pw = Math.floor((padW - ew * 2) / 2);
  const ph = Math.floor((padH - eh * 2) / 2);

  const out = new Float64Array(padW * padH);
  for (let j = 0; j < kh; j++) {
    const oy = ph + j;
    if (oy < 0 || oy >= padH) continue;
    for (let i = 0; i < kw; i++) {
      const ox = pw + i;
      if (ox < 0 || ox >= padW) continue;
      out[oy * padW + ox] = kernel[j * kw + i];
    }
  }
  return out;
}

// ─── Binary dilation (spike-mask expansion) — separable box filter, O(w·h) total ──────────────
//
// ⚠️ 2026-08-28 效能修正：舊版是逐像素 O(半徑²) 全窗口掃描套用橢圓結構元素（預設 radius=6 時，
// 169 格核心 × 3 色版，在 padding 到 2048×2048 的緩衝區上，疊代量級可能比 FFT 本身還大，卻沒有記錄
// 在這個檔案自己的效能誠實揭露段落裡）。改用可分離（水平再垂直兩次 1D 掃描）的滑動窗口總和演算法。
// 這個函式的實際輸入永遠是二元值（呼叫端在套用前已經把遮罩量化成 0 或 255——見 `apply()` 裡
// `mask[idx] = spectrum[idx] > threshold ? 255 : 0` 那段），所以跟 dieline-engine.ts 的二元侵蝕/
// 膨脹用的是同一招：「視窗內總和 >0」等價於「視窗內至少一格是 255」，可以用進出視窗各一像素的
// 滑動總和在 O(1) 攤銷時間更新，不需要真正處理連續灰階值的通用滑動窗口最大值演算法。誠實揭露一個
// 形狀取捨：可分離性只對正方形/矩形結構元素成立，原本的橢圓形結構元素無法真正分離，因此改用正方形
// 視窗——對「把偵測到的頻譜尖峰遮罩往外擴一圈再模糊」這個用途，方形跟橢圓形視窗的差異只在遮罩邊緣
// 的圓角程度，後面還會再做高斯模糊柔化邊緣，實務上不影響最終去網紋效果（已用真實週期圖案測試組
// 驗證高頻能量下降幅度不變，見 tests/moire-descreen.test.ts）。
function grayscaleDilate(src: Float64Array, w: number, h: number, radius: number): Float64Array {
  if (radius <= 0) return new Float64Array(src);

  // Horizontal pass
  const afterRows = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    const rowBase = y * w;
    let sum = 0;
    for (let dx = 0; dx <= radius && dx < w; dx++) sum += src[rowBase + dx] > 0 ? 1 : 0;
    for (let x = 0; x < w; x++) {
      afterRows[rowBase + x] = sum > 0 ? 1 : 0;
      const leaveX = x - radius;
      const enterX = x + radius + 1;
      if (leaveX >= 0) sum -= src[rowBase + leaveX] > 0 ? 1 : 0;
      if (enterX < w) sum += src[rowBase + enterX] > 0 ? 1 : 0;
    }
  }

  // Vertical pass
  const out = new Float64Array(w * h);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let dy = 0; dy <= radius && dy < h; dy++) sum += afterRows[dy * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum > 0 ? 255 : 0;
      const leaveY = y - radius;
      const enterY = y + radius + 1;
      if (leaveY >= 0) sum -= afterRows[leaveY * w + x];
      if (enterY < h) sum += afterRows[enterY * w + x];
    }
  }

  return out;
}

// ─── Separable Gaussian blur (border-replicate, matching cv2.BORDER_REPLICATE) ────────────────

function gaussianBlur(src: Float64Array, w: number, h: number, sigma: number): Float64Array {
  if (sigma <= 0) return src;
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float64Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const tmp = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    const rowBase = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = clampIndex(x + k, w);
        acc += src[rowBase + sx] * kernel[k + radius];
      }
      tmp[rowBase + x] = acc;
    }
  }

  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = clampIndex(y + k, h);
        acc += tmp[sy * w + x] * kernel[k + radius];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

function clampIndex(i: number, n: number): number {
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

// ─── 2D complex FFT (radix-2 Cooley-Tukey, separable rows-then-columns) ────────────────────────
// Forward is scaled by 1/(w*h) and inverse is left unscaled, matching cv2.dft's DFT_SCALE flag
// (used by the original on the forward transform) paired with a plain cv2.idft — this specific
// split matters because the threshold comparison downstream is calibrated against that scaling.

export function fftshift2d(re: Float64Array, im: Float64Array, w: number, h: number): void {
  const hw = w >> 1;
  const hh = h >> 1;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const x2 = (x + hw) % w;
      const y2 = y + hh;
      swap(re, im, y * w + x, y2 * w + x2);
    }
  }
}

function swap(re: Float64Array, im: Float64Array, a: number, b: number): void {
  const tr = re[a];
  re[a] = re[b];
  re[b] = tr;
  const ti = im[a];
  im[a] = im[b];
  im[b] = ti;
}

export function fft2d(re: Float64Array, im: Float64Array, w: number, h: number, invert: boolean): void {
  const rowRe = new Float64Array(w);
  const rowIm = new Float64Array(w);
  for (let y = 0; y < h; y++) {
    const base = y * w;
    for (let x = 0; x < w; x++) {
      rowRe[x] = re[base + x];
      rowIm[x] = im[base + x];
    }
    fft1d(rowRe, rowIm, invert);
    for (let x = 0; x < w; x++) {
      re[base + x] = rowRe[x];
      im[base + x] = rowIm[x];
    }
  }

  const colRe = new Float64Array(h);
  const colIm = new Float64Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      colRe[y] = re[y * w + x];
      colIm[y] = im[y * w + x];
    }
    fft1d(colRe, colIm, invert);
    for (let y = 0; y < h; y++) {
      re[y * w + x] = colRe[y];
      im[y * w + x] = colIm[y];
    }
  }

  if (!invert) {
    const scale = 1 / (w * h);
    for (let i = 0; i < re.length; i++) {
      re[i] *= scale;
      im[i] *= scale;
    }
  }
}

/** In-place iterative radix-2 Cooley-Tukey FFT/IFFT. `n = re.length` must be a power of 2. */
function fft1d(re: Float64Array, im: Float64Array, invert: boolean): void {
  const n = re.length;
  if (n <= 1) return;

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = ((invert ? 1 : -1) * 2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let start = 0; start < n; start += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < half; k++) {
        const evenIdx = start + k;
        const oddIdx = start + k + half;
        const evR = re[evenIdx], evI = im[evenIdx];
        const odR = re[oddIdx], odI = im[oddIdx];
        const twR = curRe * odR - curIm * odI;
        const twI = curRe * odI + curIm * odR;
        re[evenIdx] = evR + twR;
        im[evenIdx] = evI + twI;
        re[oddIdx] = evR - twR;
        im[oddIdx] = evI - twI;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}
