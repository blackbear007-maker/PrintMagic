import { nextPow2, reflectPad, fft2d, fftshift2d } from './moire-descreen';

/**
 * Moiré Risk Predictor — preflight warning for artwork that risks moiré against print screening,
 * BEFORE printing (distinct from `moire-descreen.ts`, which removes moiré already baked into a
 * photographed/scanned source).
 *
 * Real math: Amidror, Hersch & Ostromoukhov, "Spectral Analysis and Minimization of Moiré
 * Patterns in Color Separation," Journal of Electronic Imaging 3(3), 1994 (open access:
 * https://perso.liris.cnrs.fr/victor.ostromoukhov/publications/pdf/JEI94_Moire.pdf). For two
 * superposed periodic gratings of period T1, T2 and angle difference α, the dominant (most
 * visible) moiré term has period:
 *
 *   T = T1·T2 / sqrt(T1² + T2² − 2·T1·T2·cos(α))                              (paper's Eq. 6.1)
 *
 * — this is the classical two-grating moiré period formula the paper itself attributes to
 * earlier work; the paper's own contribution generalized it to N gratings via vector sums
 * (Eq. 5-6), which isn't needed for the two-grating case (artwork pattern vs. one print screen)
 * this module targets. A near-zero angle difference between two near-equal periods is the worst
 * case (the paper calls this the "singular" state) — T grows without bound as the two gratings
 * approach identical, meaning the beat pattern becomes large-scale and highly visible even though
 * neither original grating is individually resolvable by the eye.
 *
 * What this module adds on top of that verified formula (own engineering judgement, not from the
 * paper — the paper gives no absolute visibility threshold in physical units):
 * 1. Detecting T1/angle from the actual artwork via the same FFT machinery `moire-descreen.ts`
 *    already uses (peak-finding in the log-magnitude spectrum, excluding the low-frequency
 *    "image content" region), rather than requiring the user to already know their pattern's
 *    period. Runs the FFT on a box-averaged downsample to a fixed small working size (this is a
 *    preflight check, not a full filter) and rescales the detected period back to the source
 *    image's own pixel units — real print images are essentially always larger than any FFT size
 *    that would stay fast enough to run automatically, so this downsamples rather than rejecting
 *    large inputs outright.
 * 2. Converting a chosen halftone screen ruling (LPI) at a target print DPI into its period T2 in
 *    the same pixel units as T1.
 * 3. Mapping the resulting predicted moiré period into a risk tier by its size in millimeters at
 *    the real print DPI — these mm cutoffs are a reasonable heuristic (small beat = blends into
 *    perceived texture, large beat = an obvious wavy artifact across the print), not a
 *    scientifically validated visibility threshold.
 */

export interface DetectedPeriodicity {
  /** Spatial period of the dominant repeating pattern, in source-image pixels. */
  periodPx: number;
  /** Orientation of the pattern, in degrees. */
  angleDeg: number;
  /** How far the peak stands above the spectrum's typical (median) magnitude — a confidence signal, not a physical unit. */
  prominence: number;
}

export interface ScreenMoireAssessment {
  lpi: number;
  /** Worst-case predicted moiré period across the 4 standard CMYK screen angles (15°/75°/0°/45°), in mm at the given print DPI. */
  predictedMoirePeriodMm: number;
  riskLevel: 'low' | 'moderate' | 'high';
}

const STANDARD_CMYK_SCREEN_ANGLES_DEG = [15, 75, 0, 45];
const DEFAULT_SCREENS_LPI = [133, 150, 175, 200];

// This is a quick preflight check, not a full filter, so the FFT always runs at a small fixed
// working resolution regardless of the source image's actual size (see the box-downsample note
// on `detectDominantPeriodicity` below) — real print images are essentially always larger than
// any hard pixel cap would allow, so rejecting them outright would make this feature never fire
// in practice. Kept exported for backward compatibility / tests that reference the old cap name.
export const MAX_PREDICTOR_INPUT_PIXELS = 800 * 800;
const WORKING_MAX_DIMENSION = 768;

export class MoireRiskPredictor {
  /**
   * Finds the strongest periodic (non-DC) frequency component in the image, if any stands out
   * clearly above the general spectrum. Returns null if nothing looks like a real repeating
   * pattern (e.g. a photo with no fine regular texture) — that's a valid, common result.
   */
  public static detectDominantPeriodicity(source: ImageData): DetectedPeriodicity | null {
    const { width: srcW, height: srcH, data } = source;

    // Box-average downsample to a fixed small working resolution before the FFT — this is a
    // preflight check, not a full filter, and real print images (often thousands of pixels per
    // side) would otherwise always exceed any reasonable direct-FFT size. Uses a clean INTEGER
    // decimation factor `n` (every output pixel = the average of exactly n×n source pixels) —
    // deliberately not a fractional scale ratio: a fractional ratio (e.g. 1600/768 = 25/12) makes
    // most output bins average n source pixels but some average n+1, an unevenly-modulated
    // grouping whose own periodicity (repeating every `denominator` output pixels) can alias with
    // the image's real pattern and produce a spurious detected frequency — verified this
    // empirically produced a 3x-wrong period on a synthetic 32px-period test image before
    // switching to integer decimation. The detected period is rescaled back to the ORIGINAL
    // image's pixel units before returning, so callers never see the internal working resolution.
    const decimFactor = Math.max(1, Math.ceil(Math.max(srcW, srcH) / WORKING_MAX_DIMENSION));
    const scale = 1 / decimFactor;
    const workW = Math.max(8, Math.ceil(srcW / decimFactor));
    const workH = Math.max(8, Math.ceil(srcH / decimFactor));
    const lumPlane = downsampleLuminance(data, srcW, srcH, workW, workH, decimFactor);

    const padW = nextPow2(workW);
    const padH = nextPow2(workH);
    const re = reflectPad(lumPlane, workW, workH, padW, padH);
    const im = new Float64Array(padW * padH);

    // Apply a 2D Hann window before the FFT. A non-periodic signal (e.g. a plain gradient) has a
    // hard discontinuity at the array wrap-around edge, which "leaks" energy across many
    // frequency bins (Gibbs-phenomenon-like) and can create a spurious, non-repeating-pattern
    // peak that looks periodic but isn't. Windowing tapers the edges to zero, removing that
    // leakage; a genuinely repeating pattern's peak survives windowing essentially intact since
    // it isn't concentrated at the edges.
    applyHannWindow2d(re, padW, padH);

    fft2d(re, im, padW, padH, false);
    fftshift2d(re, im, padW, padH);

    const n = padW * padH;
    const magnitude = new Float64Array(n);
    for (let i = 0; i < n; i++) magnitude[i] = Math.hypot(re[i], im[i]);

    const cx = padW >> 1;
    const cy = padH >> 1;
    // Protect the central low-frequency region (real image content — including ordinary smooth
    // gradients like lighting falloff or sky) from being mistaken for a repeating pattern.
    // Expressed as "the pattern must complete at least MIN_REPETITIONS full cycles across the
    // working image" rather than a fixed fraction of the padded FFT size: a fixed padW-based
    // fraction is NOT scale-invariant once box-downsampling is involved (see the decimFactor note
    // above) — for a heavily-downsampled large image, padW ends up much larger relative to the
    // pattern's own working-domain period than for a small image, so the same padW-fraction
    // radius silently swallows genuinely fine real patterns (verified empirically: a real 32px-
    // period test pattern in a 1600px image was being excluded this way, leaving its 3rd harmonic
    // as the strongest surviving peak — a 3x-wrong detected period). Requiring a minimum cycle
    // count is invariant to how much downsampling happened.
    const MIN_REPETITIONS = 3;
    const dcExcludeRadius = Math.max(4, (MIN_REPETITIONS * padW) / Math.max(workW, workH));

    let peakIdx = -1;
    let peakMag = -Infinity;
    const magnitudesForMedian: number[] = [];
    for (let y = 0; y < padH; y++) {
      for (let x = 0; x < padW; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        if (r < dcExcludeRadius) continue;
        const idx = y * padW + x;
        magnitudesForMedian.push(magnitude[idx]);
        if (magnitude[idx] > peakMag) {
          peakMag = magnitude[idx];
          peakIdx = idx;
        }
      }
    }
    if (peakIdx < 0) return null;

    const median = quickSelectMedian(magnitudesForMedian, Math.floor(magnitudesForMedian.length / 2)) || 1e-6;
    const prominence = peakMag / Math.max(median, 1e-6);

    // A real periodic pattern's peak stands out sharply from the rest of the spectrum; a
    // non-periodic photo's spectrum is comparatively flat/broadband — require a clear margin.
    if (prominence < 6) return null;

    const py = Math.floor(peakIdx / padW);
    const px = peakIdx % padW;
    const dx = px - cx;
    const dy = py - cy;

    // Global prominence alone isn't enough: a plain gradient's spectrum has genuine broadband
    // energy that decays SMOOTHLY and monotonically outward from DC (no sharp peak, just a long
    // shallow tail) — measured against a global median dominated by true-zero far bins, a point
    // partway down that tail can still look "prominent." A real periodic pattern instead produces
    // a genuinely NARROW spike concentrated at one specific frequency. Distinguish them by radial
    // decay: sample the magnitude at ~1.8x the peak's own distance from DC, along the same
    // direction — a real spike drops off sharply past itself; a gradient's tail is still
    // significant out there.
    const outR = Math.hypot(dx, dy) * 1.8;
    const outX = Math.round(cx + (dx / Math.hypot(dx, dy)) * outR);
    const outY = Math.round(cy + (dy / Math.hypot(dx, dy)) * outR);
    let radialDecayRatio = Infinity;
    if (outX >= 0 && outX < padW && outY >= 0 && outY < padH) {
      const farMag = magnitude[outY * padW + outX];
      radialDecayRatio = peakMag / Math.max(farMag, 1e-6);
    }
    // Empirically calibrated margin: genuine periodic test patterns measured radial decay ratios
    // in the thousands to millions; a plain gradient's leakage right at the DC-exclusion boundary
    // measured only ~5.6x (it decays, but far more gradually than a real narrowband spike). 50x
    // sits with a wide safety margin below the genuine cases and well above the gradient case.
    if (radialDecayRatio < 50) return null;

    // Frequency in cycles/pixel along each axis, in the WORKING (downsampled, padded) image's
    // pixel grid — normalize by the padded size (the transform's actual sample grid).
    const fx = dx / padW;
    const fy = dy / padH;
    const freq = Math.hypot(fx, fy);
    if (freq <= 0) return null;

    // Rescale the period back to the ORIGINAL image's pixel units (divide by `scale`, since the
    // working image was `scale`x the original size) — callers should never need to know this
    // function ran its FFT on a downsampled copy. Angle is scale-invariant, no rescale needed.
    const periodPx = 1 / freq / scale;
    const angleDeg = ((Math.atan2(fy, fx) * 180) / Math.PI + 180) % 180; // gratings are 180°-periodic

    return { periodPx, angleDeg, prominence: Math.round(prominence * 10) / 10 };
  }

  /** The verified Amidror/Hersch/Ostromoukhov two-grating moiré period formula (see header). */
  public static moirePeriod(t1: number, angle1Deg: number, t2: number, angle2Deg: number): number {
    const alpha = ((angle1Deg - angle2Deg) * Math.PI) / 180;
    const denom = Math.sqrt(t1 * t1 + t2 * t2 - 2 * t1 * t2 * Math.cos(alpha));
    return denom > 1e-9 ? (t1 * t2) / denom : Infinity;
  }

  /**
   * Detects the artwork's dominant periodicity (if any) and predicts moiré risk against a set of
   * standard halftone screen rulings at the given print DPI.
   */
  public static assess(
    source: ImageData,
    printDpi: number,
    screensLpi: number[] = DEFAULT_SCREENS_LPI
  ): { detected: DetectedPeriodicity | null; assessments: ScreenMoireAssessment[] } {
    const detected = this.detectDominantPeriodicity(source);
    if (!detected) {
      return {
        detected: null,
        assessments: screensLpi.map((lpi) => ({ lpi, predictedMoirePeriodMm: 0, riskLevel: 'low' as const }))
      };
    }

    const assessments: ScreenMoireAssessment[] = screensLpi.map((lpi) => {
      const t2 = printDpi / lpi; // screen period, in the same "pixels at printDpi" unit as periodPx once scaled below.
      // Scale the detected pattern's period from source-image pixels to print pixels via DPI
      // ratio isn't knowable without the artwork's own resolution context — this module treats
      // periodPx as already being in print-resolution pixels (i.e. call this on the image at its
      // final print size/DPI for a meaningful mm result); documented on `assess()`'s call sites.
      let worstPeriodPx = 0;
      for (const screenAngle of STANDARD_CMYK_SCREEN_ANGLES_DEG) {
        const period = this.moirePeriod(detected.periodPx, detected.angleDeg, t2, screenAngle);
        if (period > worstPeriodPx) worstPeriodPx = period;
      }
      const periodMm = Math.min(worstPeriodPx, 1e6) / printDpi * 25.4;

      // Heuristic tiering (own engineering judgement — see header note): a beat pattern under
      // ~2mm blends into perceived texture; over ~15mm reads as an obvious large-scale wave.
      const riskLevel: ScreenMoireAssessment['riskLevel'] =
        periodMm > 15 ? 'high' : periodMm > 2 ? 'moderate' : 'low';

      return { lpi, predictedMoirePeriodMm: Math.round(periodMm * 10) / 10, riskLevel };
    });

    return { detected, assessments };
  }
}

/**
 * Converts RGBA pixel data directly to a box-averaged, downsampled luminance plane in one pass,
 * using a clean integer n×n decimation factor (see the caller's note on why this must be an
 * integer, not a fractional scale ratio — a fractional ratio's unevenly-modulated group sizes can
 * alias with the image's real periodic content and produce a spurious detected frequency). Every
 * output pixel is the average of exactly n×n source pixels, except possibly a smaller partial
 * block at the right/bottom edge when n doesn't evenly divide srcW/srcH.
 */
function downsampleLuminance(
  data: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  decimFactor: number
): Float64Array {
  const sums = new Float64Array(dstW * dstH);
  const counts = new Int32Array(dstW * dstH);

  for (let y = 0; y < srcH; y++) {
    const dy = Math.min(dstH - 1, Math.floor(y / decimFactor));
    const rowBase = y * srcW;
    const dstRowBase = dy * dstW;
    for (let x = 0; x < srcW; x++) {
      const dx = Math.min(dstW - 1, Math.floor(x / decimFactor));
      const i = (rowBase + x) * 4;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const dstIdx = dstRowBase + dx;
      sums[dstIdx] += lum;
      counts[dstIdx]++;
    }
  }

  const out = new Float64Array(dstW * dstH);
  for (let i = 0; i < out.length; i++) out[i] = counts[i] > 0 ? sums[i] / counts[i] : 0;
  return out;
}

/**
 * Returns the k-th smallest element (0-indexed) of `arr` via Lomuto-partition quickselect,
 * mutating `arr` in place. O(n) average vs. a full O(n log n) sort — used because the caller only
 * needs one order statistic (the median), not the whole sorted spectrum. Selecting the k-th order
 * statistic gives the exact same value a full sort's `sorted[k]` would, for any input including
 * ties/duplicates.
 */
export function quickSelectMedian(arr: Float64Array | number[], k: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const pivotIdx = lo + Math.floor(Math.random() * (hi - lo + 1));
    const pivotVal = arr[pivotIdx];
    const tmp1 = arr[pivotIdx];
    arr[pivotIdx] = arr[hi];
    arr[hi] = tmp1;
    let storeIdx = lo;
    for (let i = lo; i < hi; i++) {
      if (arr[i] < pivotVal) {
        const tmp2 = arr[i];
        arr[i] = arr[storeIdx];
        arr[storeIdx] = tmp2;
        storeIdx++;
      }
    }
    const tmp3 = arr[storeIdx];
    arr[storeIdx] = arr[hi];
    arr[hi] = tmp3;

    if (storeIdx === k) return arr[storeIdx];
    if (storeIdx < k) lo = storeIdx + 1;
    else hi = storeIdx - 1;
  }
  return arr[lo];
}

function applyHannWindow2d(plane: Float64Array, w: number, h: number): void {
  // Periodic/DFT-even convention (divide by w, not w-1) — this makes the window's own spectrum
  // an exact 3-tap sinc (energy only at k=0 and k=±1), verified numerically against a flat test
  // image (k=2 and beyond measured at ~1e-15, i.e. floating-point noise). The more common
  // "symmetric" convention (divide by w-1, used for FIR filter design) leaves the window
  // slightly non-periodic over the FFT length and leaks real energy into many further bins —
  // exactly the kind of spurious peak this window is meant to eliminate.
  const wx = new Float64Array(w);
  for (let x = 0; x < w; x++) wx[x] = 0.5 * (1 - Math.cos((2 * Math.PI * x) / w));
  const wy = new Float64Array(h);
  for (let y = 0; y < h; y++) wy[y] = 0.5 * (1 - Math.cos((2 * Math.PI * y) / h));

  for (let y = 0; y < h; y++) {
    const rowBase = y * w;
    const rowWeight = wy[y];
    for (let x = 0; x < w; x++) {
      plane[rowBase + x] *= wx[x] * rowWeight;
    }
  }
}
