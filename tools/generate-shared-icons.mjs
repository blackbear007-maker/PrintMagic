#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'icons', 'shared');
const PROVENANCE_PATH = path.join(OUTPUT_DIR, 'provenance.json');
const MODELS = ['gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'];
const ENDPOINT_BASE = 'https://aiplatform.googleapis.com/v1beta1/projects';

/**
 * Round 2: the rest of the icon inventory (everything outside the top header row already covered
 * by generate-header-icons.mjs / public/icons/header/). Deduplicated by MEANING, not by call site —
 * the same emoji/concept reused across many modals (e.g. ✕ close buttons, ✓ confirmations) gets one
 * shared asset here instead of being regenerated per file. National flag emoji (🇹🇼🇪🇺🇺🇸) and pure
 * typographic glyphs (➔ ▾ ▲ ▼ ↻ etc.) are intentionally excluded — left as native characters.
 */
const ICONS = [
  { id: 'close', emoji: '✕', subject: 'a simple X cross mark made of two crossing diagonal lines, symbolizing closing a dialog' },
  { id: 'check', emoji: '✓', subject: 'a single checkmark tick, symbolizing confirmation or success' },
  { id: 'ruler-vector', emoji: '📐', subject: 'a set-square drafting triangle ruler, symbolizing precision vector tracing or measurement' },
  { id: 'magnifier', emoji: '🔍', subject: 'a round magnifying glass with a handle, symbolizing zoom or detailed inspection' },
  { id: 'sun', emoji: '☀️', subject: 'a simple sun with a circle center and short rays around it, symbolizing brightness or light correction' },
  { id: 'magic-wand', emoji: '🪄', subject: 'a magic wand with a small star sparkle at its tip, symbolizing automatic AI object removal' },
  { id: 'scissors', emoji: '✂️', subject: 'a pair of open scissors, symbolizing cutting or background removal' },
  { id: 'face-scan', emoji: '🧑', subject: 'a simple rounded human head and shoulders silhouette outline with a small corner-bracket scan frame around it, symbolizing face detection' },
  { id: 'printer', emoji: '🖨️', subject: 'a simple desktop printer viewed from the front with a paper slot, symbolizing printing or output' },
  { id: 'sparkle', emoji: '✨', subject: 'three small four-pointed sparkle stars of varying size, symbolizing an automatic AI enhancement' },
  { id: 'contrast', emoji: '🌓', subject: 'a circle that is half filled solid and half outline only, like a half moon, symbolizing tonal contrast' },
  { id: 'rainbow-gamut', emoji: '🌈', subject: 'a simple arched rainbow drawn as three concentric curved bands, symbolizing color gamut or spectrum' },
  { id: 'document-page', emoji: '📄', subject: 'a simple rectangular page with a small folded corner at the top right, symbolizing a document or page' },
  { id: 'picture', emoji: '🖼️', subject: 'a simple rectangular picture frame containing a small mountain triangle and a sun circle, symbolizing an image' },
  { id: 'envelope', emoji: '✉️', subject: 'a simple closed envelope with a V-shaped flap, symbolizing a postcard or mailed item' },
  { id: 'id-card', emoji: '📇', subject: 'a simple rounded rectangle card with a small circle portrait on the left and two short horizontal lines of text on the right, symbolizing a business or ID card' },
  { id: 'tag', emoji: '🏷️', subject: 'a single price tag shape with a small hole near the top and a short string loop, symbolizing a label or sticker' },
  { id: 'phone', emoji: '📱', subject: 'a simple rounded rectangle smartphone outline with a small circle button near the bottom, symbolizing a mobile device' },
  { id: 'book', emoji: '📖', subject: 'a simple open book shape with a center spine line and two pages, symbolizing paper stock or a booklet' },
  { id: 'gem-facet', emoji: '🌸💎⚡🌈', subject: 'a simple faceted gemstone/diamond outline with a few internal facet lines, symbolizing a premium decorative finish' },
  { id: 'download', emoji: '📥', subject: 'a simple downward arrow pointing into an open tray/inbox shape, symbolizing downloading a file' },
  { id: 'palette', emoji: '🎨', subject: "a simple painter's palette shape with a thumb hole and a few small paint dots, symbolizing color or ink" },
  { id: 'folder-upload', emoji: '📁', subject: 'a simple folder shape with a small upward arrow above it, symbolizing uploading a file' },
  { id: 'eye', emoji: '👁️', subject: 'a simple almond-shaped open eye with a circular iris in the center, symbolizing preview or comparison' },
  { id: 'refresh', emoji: '🔄', subject: 'two curved arrows chasing each other forming a circular loop, symbolizing refresh or re-upload' },
  { id: 'star-cta', emoji: '🌟', subject: 'a single five-pointed star outline with a couple of tiny sparkle flecks beside it, symbolizing a primary recommended action' },
  { id: 'store', emoji: '🏪🏬', subject: 'a simple storefront building with a scalloped awning above the entrance, symbolizing a retail or convenience store' },
  { id: 'share', emoji: '📤', subject: 'a simple upward arrow rising out of an open box tray, symbolizing sharing or exporting' },
  { id: 'puzzle', emoji: '🧩', subject: 'a single jigsaw puzzle piece outline with one rounded tab and one rounded notch, symbolizing layout arrangement' },
  { id: 'factory', emoji: '🏭', subject: 'a simple factory building silhouette with two smoke stacks on the roof, symbolizing industrial printing' },
  { id: 'clipboard', emoji: '📋', subject: 'a simple clipboard shape with a small clip tab at the top and a few short horizontal lines below, symbolizing copying notes or specs' },
  { id: 'hexagon-vector', emoji: '⬡', subject: 'a simple regular hexagon outline, symbolizing a vector shape or SVG format' },
  { id: 'gift', emoji: '🎁', subject: 'a simple gift box shape with a cross-shaped ribbon and a small bow on top, symbolizing a free feature' },
  { id: 'pen-nib', emoji: '🔤✒️', subject: 'a simple fountain pen nib shape with a small center slit, symbolizing sharp text or vector font rendering' },
  { id: 'spiral-descreen', emoji: '🌀', subject: 'a simple spiral swirl line winding from the center outward, symbolizing descreening or pattern removal' },
  { id: 'camera', emoji: '📷', subject: 'a simple front-facing camera body shape with a circular lens in the middle, symbolizing an original photo' },
  { id: 'package-box', emoji: '📦', subject: 'a simple closed cardboard box shape with a cross-shaped tape line across the top, symbolizing a packaged export' },
  { id: 'speech-bubble', emoji: '💬', subject: 'a simple rounded rectangle speech bubble with a small triangular tail at the bottom left, symbolizing a message or note' },
  { id: 'shield', emoji: '🛡️', subject: 'a simple shield outline shape with a pointed bottom, symbolizing protection or compliance' },
  { id: 'credit-card', emoji: '💳', subject: 'a simple rounded rectangle card with one horizontal stripe near the top, symbolizing a physical reference card' },
  { id: 'rocket', emoji: '🚀', subject: 'a simple rocket ship silhouette with a pointed nose, small fins, and a short flame beneath it, symbolizing a boost or launch' },
  { id: 'hourglass', emoji: '⏳', subject: 'a simple hourglass shape with a narrow waist, symbolizing a loading or processing wait' },
  { id: 'robot', emoji: '🤖', subject: 'a simple friendly robot head shape with two short antennae dots on top and a small rectangular screen face, symbolizing automated scanning' },
  { id: 'building', emoji: '🏢', subject: 'a simple rectangular office building silhouette with a grid of small square windows, symbolizing a brand or company' },
  { id: 'pin-location', emoji: '📍', subject: 'a simple map pin teardrop shape with a small circle hole near the top, symbolizing a location' },
  { id: 'clock', emoji: '🕒', subject: 'a simple round clock face circle with two short hands pointing to different hours, symbolizing time', },
  { id: 'phone-call', emoji: '📞', subject: 'a simple old-fashioned telephone handset/receiver shape, symbolizing a phone call' },
  { id: 'compass', emoji: '🧭', subject: 'a simple compass circle with a thin needle pointing diagonally across it, symbolizing navigation or direction' },
  { id: 'paintbrush', emoji: '🖌️', subject: 'a simple paintbrush shape with a pointed tip of bristles and a long thin handle, symbolizing brush size or drawing' },
  { id: 'sponge-erase', emoji: '🧽', subject: 'a simple rounded rectangular sponge block shape with a few small texture dimples, symbolizing erasing' },
  { id: 'trash', emoji: '🗑️', subject: 'a simple trash can/bin outline with a lid and two vertical lines inside for ribbing, symbolizing deleting or clearing' },
  { id: 'wave-gradient', emoji: '🌊', subject: 'two stacked horizontal wavy curved lines, symbolizing a smooth gradient or waveform' },
  { id: 'droplet', emoji: '💧', subject: 'a simple water droplet teardrop shape with a rounded bottom and pointed top, symbolizing ink amount or saturation' },
  { id: 'filmstrip', emoji: '🎞️', subject: 'a simple horizontal filmstrip band with a row of small square perforation holes along the top and bottom edges, symbolizing a batch or gallery of images' },
  { id: 'bar-chart', emoji: '📊', subject: 'a simple bar chart with three vertical bars of increasing height side by side, symbolizing a score or analytics panel' },
  { id: 'info', emoji: 'ℹ️', subject: 'a simple circle outline containing a small vertical line with a dot above it like a lowercase i, symbolizing an informational note' },
  { id: 'checkered-flag', emoji: '🏁', subject: 'a simple small checkered flag on a short pole, symbolizing a final verification pass' },
  { id: 'lock', emoji: '🔒', subject: 'a simple closed padlock shape with a rounded shackle on top, symbolizing privacy or a locked/protected state' },
  { id: 'warning', emoji: '⚠️', subject: 'a simple triangle outline containing a vertical exclamation mark line with a dot below it, symbolizing a warning or issue that needs attention' },
  { id: 'globe', emoji: '🌐', subject: 'a simple globe circle with one horizontal ellipse band and two vertical meridian curves crossing through it, symbolizing the web or an official website' },
];

// See generate-header-icons.mjs for the full rationale: models render "transparent background" as
// a literal checkerboard PATTERN baked into opaque pixels instead of real alpha, so a flat magenta
// fill is requested instead and deterministically keyed out to real alpha in convertToWebp below.
const STYLE_LOCK = [
  'a single small square app icon, flat minimalist ink-brush line-art style',
  'one continuous confident brush stroke of muted indigo-purple ink (#4b2aa8), uniform stroke weight, rounded stroke ends',
  'the ENTIRE background (100 percent of the canvas outside the ink strokes) filled with one single flat solid pure magenta color, hex FF00FF, perfectly uniform with zero variation, no gradient, no texture, no pattern, no checkerboard, no shading, no vignette — this magenta fill is a chroma-key placeholder that will be programmatically removed, it is not part of the artwork and must not resemble anything',
  'no background shape of any kind behind the subject: no circle, no rounded square, no rounded rectangle, no app-icon tile, no card, no badge, no chip, no vignette, no shadow, no drop shadow, no glow — the magenta must reach flat and unbroken all the way to all four edges and all four corners of the canvas with nothing else drawn in it',
  'centered subject filling about 70 percent of the canvas, generous even padding of solid magenta on all sides',
  'flat 2D vector look, no gradients, no 3D shading, no photorealism, no textures, no outlines around the whole canvas',
  'part of a consistent icon set for a print-preflight studio app called 印象魔法 PrintMagic, calm and professional, not playful or cartoonish',
].join(', ');

const NEGATIVE_LOCK = [
  'no text, no letters, no numbers, no watermark, no logo, no signature',
  'no color anywhere in the icon subject other than the single indigo-purple ink tone (pure monochrome line art) — the ONLY other color allowed anywhere in the image is the solid magenta background fill',
  'no emoji-style rendering, no glossy highlights, no multiple objects, no border, no frame, no checkerboard pattern anywhere',
].join(', ');

function buildPrompt(icon) {
  return [
    'Create one square 1:1 icon.',
    STYLE_LOCK + '.',
    `Subject: ${icon.subject}.`,
    NEGATIVE_LOCK + '.',
  ].join(' ');
}

function projectFromEnv(env = process.env) {
  return env.GOOGLE_CLOUD_PROJECT || env.GOOGLE_VERTEX_PROJECT || '';
}

async function resolveProject(env = process.env) {
  const configured = projectFromEnv(env);
  if (configured) return configured;
  try {
    const command = process.platform === 'win32' ? 'powershell.exe' : 'gcloud';
    const args = process.platform === 'win32'
      ? ['-NoProfile', '-NonInteractive', '-Command', '& gcloud.cmd config get-value project --quiet']
      : ['config', 'get-value', 'project', '--quiet'];
    const result = await execFileAsync(command, args, { windowsHide: true });
    const project = result.stdout.trim();
    return project && project !== '(unset)' ? project : '';
  } catch {
    return '';
  }
}

async function resolveToken(env = process.env) {
  const direct = env.GOOGLE_VERTEX_ACCESS_TOKEN || env.GOOGLE_CLOUD_ACCESS_TOKEN;
  if (direct) return direct;
  try {
    const command = process.platform === 'win32' ? 'powershell.exe' : 'gcloud';
    const args = process.platform === 'win32'
      ? ['-NoProfile', '-NonInteractive', '-Command', '& gcloud.cmd auth print-access-token --quiet']
      : ['auth', 'print-access-token', '--quiet'];
    const result = await execFileAsync(command, args, { windowsHide: true });
    const token = result.stdout.trim();
    if (token) return token;
  } catch {
    // The caller receives a secret-free actionable message below.
  }
  throw new Error('找不到 Google Cloud access token');
}

function buildRequest(prompt) {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
}

function decodeImage(body) {
  const parts = body?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || [];
  const inline = parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
  const base64 = inline?.inlineData?.data || inline?.inline_data?.data;
  if (!base64) throw new Error('Vertex AI 回應沒有圖片資料');
  return Buffer.from(base64, 'base64');
}

async function requestImage({ project, token, model, prompt }) {
  const endpoint = `${ENDPOINT_BASE}/${encodeURIComponent(project)}/locations/global/publishers/google/models/${model}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequest(prompt)),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message ? `：${body.error.message}` : '';
    const error = new Error(`Vertex AI 圖片生成 HTTP ${response.status}${detail}`);
    error.status = response.status;
    throw error;
  }
  const bytes = decodeImage(body);
  if (bytes.length <= 1024) throw new Error('Vertex AI 回傳的圖片檔過小');
  return bytes;
}

// See generate-header-icons.mjs for the full rationale on border-ring sampling (handles a model
// drawing an unwanted rounded card/tile behind the subject, which leaves two background colors).
const PYTHON_TO_WEBP = `
from PIL import Image
import sys
import math

source, target = sys.argv[1], sys.argv[2]
inner, outer = 30, 90  # distance thresholds: <inner fully transparent, >outer fully opaque

with Image.open(source) as image:
    rgba = image.convert('RGBA')
    pixels = rgba.load()
    w, h = rgba.size

    border_colors = []
    step = max(1, min(w, h) // 40)
    for x in range(0, w, step):
        border_colors.append(pixels[x, 0][:3])
        border_colors.append(pixels[x, h - 1][:3])
    for y in range(0, h, step):
        border_colors.append(pixels[0, y][:3])
        border_colors.append(pixels[w - 1, y][:3])

    palette = []
    for c in border_colors:
        if not any(math.dist(c, p) < 20 for p in palette):
            palette.append(c)

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            dist = min(math.dist((r, g, b), p) for p in palette)
            if dist <= inner:
                pixels[x, y] = (r, g, b, 0)
            elif dist < outer:
                t = (dist - inner) / (outer - inner)
                pixels[x, y] = (r, g, b, round(a * t))
    rgba.save(target, 'WEBP', quality=95, method=6)
`;

async function convertToWebp(bytes, output) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  const source = `${output}.source-${process.pid}-${Date.now()}`;
  const temporary = `${output}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(source, bytes);
  try {
    await execFileAsync('python', ['-c', PYTHON_TO_WEBP, source, temporary], { windowsHide: true });
    const webp = await fs.readFile(temporary);
    if (webp.length <= 1024 || webp.subarray(0, 4).toString('ascii') !== 'RIFF' || webp.subarray(8, 12).toString('ascii') !== 'WEBP') {
      throw new Error('本機 WebP 轉檔結果無效');
    }
    await fs.rename(temporary, output);
    return webp;
  } finally {
    await fs.rm(source, { force: true });
    await fs.rm(temporary, { force: true });
  }
}

async function readExisting(file) {
  try {
    const bytes = await fs.readFile(file);
    return bytes.length > 1024 ? bytes : null;
  } catch {
    return null;
  }
}

async function writeProvenance({ project, modelByIcon, statuses }) {
  const icons = {};
  for (const icon of ICONS) {
    const file = path.join(OUTPUT_DIR, `${icon.id}.webp`);
    const bytes = await readExisting(file);
    icons[icon.id] = {
      file: `public/icons/shared/${icon.id}.webp`,
      replaces: icon.emoji,
      status: statuses[icon.id] || (bytes ? 'existing' : 'pending'),
      model: modelByIcon[icon.id] || null,
      bytes: bytes?.length || null,
      sha256: bytes ? crypto.createHash('sha256').update(bytes).digest('hex') : null,
    };
  }
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(PROVENANCE_PATH, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    provider: 'Google Cloud Vertex AI',
    scope: 'Round 2 — shared icons reused across modals/lists, deduplicated by meaning. See public/icons/header for the top nav row.',
    deliveryFormat: 'RGBA WebP with transparent background',
    project,
    preferredModel: MODELS[0],
    fallbackModel: MODELS[1],
    styleLock: `${STYLE_LOCK}. ${NEGATIVE_LOCK}.`,
    icons,
  }, null, 2)}\n`);
}

function selectedIds() {
  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length).trim();
  if (!only) return ICONS.map((icon) => icon.id);
  const ids = only.split(',').map((s) => s.trim());
  for (const id of ids) {
    if (!ICONS.some((icon) => icon.id === id)) throw new Error(`找不到指定圖示：${id}`);
  }
  return ids;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateOne({ project, token, icon, force }) {
  const output = path.join(OUTPUT_DIR, `${icon.id}.webp`);
  if (!force && await readExisting(output)) return { status: 'existing' };

  const prompt = buildPrompt(icon);
  const maxAttempts = 8;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const model = attempt % 2 === 0 ? MODELS[0] : MODELS[1];
    try {
      const bytes = await requestImage({ project, token, model, prompt });
      const webp = await convertToWebp(bytes, output);
      console.log(`生成完成：${path.relative(ROOT, output)}（${webp.length} bytes, ${model}）`);
      return { status: 'generated', model };
    } catch (error) {
      lastError = error;
      if (error.status === 429) {
        const wait = 8000 + attempt * 4000;
        console.log(`  ${icon.id}：${model} 額度限流，等待 ${Math.round(wait / 1000)}s 後重試（第 ${attempt + 1}/${maxAttempts} 次）...`);
        await sleep(wait);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const ids = selectedIds();
  const project = await resolveProject();

  console.log(`Shared 圖示${dryRun ? ' dry-run' : ''}：${ids.length} 張；首選模型 ${MODELS[0]}；fallback ${MODELS[1]}`);
  console.log(`Google Cloud project：${project || '未設定'}`);
  ids.forEach((id) => {
    const icon = ICONS.find((i) => i.id === id);
    console.log(`- ${id}（取代 ${icon.emoji}）: ${path.relative(ROOT, path.join(OUTPUT_DIR, `${id}.webp`))}`);
  });
  if (dryRun) return { generated: 0, failed: 0 };

  if (!project) {
    console.log('未生成：Google Cloud project 未設定。保留既有資產。');
    await writeProvenance({ project: '', modelByIcon: {}, statuses: {} });
    return { generated: 0, failed: 0, pending: true };
  }

  let token;
  try {
    token = await resolveToken();
  } catch (error) {
    console.log(`未生成：${error.message}。請先 gcloud auth login。保留既有資產。`);
    await writeProvenance({ project, modelByIcon: {}, statuses: {} });
    return { generated: 0, failed: 0, pending: true };
  }

  const modelByIcon = {};
  const statuses = {};
  let generated = 0;
  let failed = 0;

  for (const id of ids) {
    const icon = ICONS.find((i) => i.id === id);
    try {
      const result = await generateOne({ project, token, icon, force });
      statuses[id] = result.status;
      if (result.status === 'generated') {
        generated += 1;
        modelByIcon[id] = result.model;
      }
    } catch (error) {
      failed += 1;
      statuses[id] = 'failed';
      console.error(`生成失敗：${id}：${error.message}；保留既有資產。`);
    }
  }
  await writeProvenance({ project, modelByIcon, statuses });
  console.log(`Shared 圖示完成：新增 ${generated}、失敗 ${failed}。`);
  return { generated, failed, project };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('generate-shared-icons.mjs')) {
  main().catch((error) => {
    console.error(`Shared 圖示生成中止：${error.message}`);
    process.exitCode = 1;
  });
}

export { ICONS, MODELS, buildPrompt, buildRequest, decodeImage, main };
