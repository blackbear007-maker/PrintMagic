import type { CropAnchor, PrintPreset } from '../types';

/**
 * Print page geometry shared by BleedExpander and both PDF writers (2026-09-26).
 *
 * Before this, every exporter used the preset's width/height as-is and stretched the image into
 * trim + bleed. Presets are single-orientation (A4 is 210×297) and detectBestPreset() falls back to
 * A4 for any unmatched ratio, so a landscape 4:3 or 16:9 photo was squeezed into a portrait page, and
 * any residual ratio difference was stretched rather than cropped. The 焦點九宮格 anchor only moved
 * the on-screen preview.
 */

export interface TrimSize {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
}

/**
 * The preset's trim size turned to match the image's orientation (the score and DPI analysis already
 * assume this). A preset without a physical size (social) gets the image's own size at its target
 * DPI and no bleed, instead of falling back to a stretched A4.
 */
export function trimForImage(preset: PrintPreset, imageWidthPx: number, imageHeightPx: number): TrimSize {
  if (!(preset.widthMm > 0 && preset.heightMm > 0)) {
    const dpi = preset.targetDpi > 0 ? preset.targetDpi : 300;
    return {
      widthMm: (imageWidthPx / dpi) * 25.4,
      heightMm: (imageHeightPx / dpi) * 25.4,
      bleedMm: 0
    };
  }
  const imageLandscape = imageWidthPx > imageHeightPx;
  const presetLandscape = preset.widthMm > preset.heightMm;
  const swap = preset.widthMm !== preset.heightMm && imageWidthPx !== imageHeightPx && imageLandscape !== presetLandscape;
  return {
    widthMm: swap ? preset.heightMm : preset.widthMm,
    heightMm: swap ? preset.widthMm : preset.heightMm,
    bleedMm: preset.bleedMm || 0
  };
}

/**
 * Scale an image to cover a box without distortion; the overflow on the longer axis is cropped, and
 * the anchor picks which part stays. Returned rect is relative to the box's top-left and may extend
 * past it — callers clip to the box.
 */
export function coverFit(
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
  anchor: CropAnchor = 'center'
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const x = anchor === 'left' ? 0 : anchor === 'right' ? boxWidth - width : (boxWidth - width) / 2;
  const y = anchor === 'top' ? 0 : anchor === 'bottom' ? boxHeight - height : (boxHeight - height) / 2;
  return { x, y, width, height };
}
