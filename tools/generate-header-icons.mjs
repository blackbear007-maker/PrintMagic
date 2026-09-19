#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'icons', 'header');
const PROVENANCE_PATH = path.join(OUTPUT_DIR, 'provenance.json');
const MODELS = ['gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'];
const ENDPOINT_BASE = 'https://aiplatform.googleapis.com/v1beta1/projects';

/**
 * Pilot batch: only the top header/toolbar row (src/ui/app-shell.ts lines ~24-64), not the
 * 150+ icons found across the rest of the app. Each entry is one square icon; `emoji` is the
 * character it replaces, kept here only for the console log / provenance file, never sent
 * verbatim into the prompt (models render emoji glyphs literally otherwise).
 */
const ICONS = [
  { id: 'mode-simple', emoji: '🌱', subject: 'a small sprouting seedling with two young leaves, symbolizing an easy beginner-friendly mode' },
  { id: 'mode-advanced', emoji: '⚙️', subject: 'a single mechanical gear cog, symbolizing advanced/pro settings' },
  { id: 'engine-local', emoji: '🖥️', subject: 'a simple flat-front desktop monitor/computer screen, symbolizing on-device local processing' },
  { id: 'engine-cloud', emoji: '⚡', subject: 'a cloud shape with a small lightning bolt inside it, symbolizing an active cloud-powered service' },
  { id: 'text-inspect', emoji: '📝', subject: 'a pencil writing on a small notepad page, symbolizing text proofreading/inspection' },
  { id: 'upscale-local', emoji: '⚡', subject: 'a single bold lightning bolt, symbolizing a fast local algorithm' },
  { id: 'upscale-cloud', emoji: '🔬', subject: 'a simple laboratory microscope silhouette, symbolizing a higher-quality cloud analysis service' },
  { id: 'pipeline-matrix', emoji: '🎛️', subject: 'three vertical audio-mixer slider controls at different heights, symbolizing expert/custom pipeline controls' },
  { id: 'guide', emoji: '💡', subject: 'a single glowing light bulb, symbolizing a quick-start guide or helpful tip' },
  { id: 'calibration', emoji: '📏', subject: 'a straight ruler with evenly spaced tick marks, symbolizing physical on-screen measurement calibration' },
];

// The background is a solid chroma-key color, not real alpha: several models render "transparent
// background" as a literal checkerboard PATTERN baked into opaque pixels instead of setting alpha,
// which produced unusable icons on the first pass. A flat magenta fill is deterministically keyed
// out to real alpha in convertToWebp below, so correctness doesn't depend on the model's judgment.
const CHROMA_KEY = { r: 255, g: 0, b: 255 };

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

// Keys out the chroma-key background into real per-pixel alpha. The requested fill is solid
// magenta (FF00FF) covering the whole canvas, but in practice a model sometimes ignores that and
// draws a rounded card/tile behind the subject instead — leaving TWO background colors (e.g. a
// white canvas corner outside the tile, plus the pink tile fill itself), not one flat fill. Instead
// of sampling only the four corner pixels (which only catches one of those colors), this samples
// many points around the full border ring and keys out anything close to ANY sampled border color.
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

    # Collapse near-duplicate samples into a small palette of distinct background colors.
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
      file: `public/icons/header/${icon.id}.webp`,
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
    scope: 'Pilot batch — top header/toolbar row only (src/ui/app-shell.ts), see docs/SPEC.md for the full 150+ icon inventory',
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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const ids = selectedIds();
  const project = await resolveProject();

  console.log(`Header 圖示 pilot${dryRun ? ' dry-run' : ''}：${ids.length} 張；首選模型 ${MODELS[0]}；fallback ${MODELS[1]}`);
  console.log(`Google Cloud project：${project || '未設定'}`);
  ids.forEach((id) => {
    const icon = ICONS.find((i) => i.id === id);
    console.log(`- ${id}（取代 ${icon.emoji}）: ${path.relative(ROOT, path.join(OUTPUT_DIR, `${id}.webp`))}`);
  });
  if (dryRun) return { generated: 0, failed: 0 };

  if (!project) {
    console.log('未生成：Google Cloud project 未設定（請先 gcloud auth login 並 gcloud config set project <id>，或設定 GOOGLE_CLOUD_PROJECT 環境變數）。保留既有資產。');
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
  let activeModel = MODELS[0];
  let generated = 0;
  let failed = 0;

  for (const id of ids) {
    const icon = ICONS.find((i) => i.id === id);
    const output = path.join(OUTPUT_DIR, `${id}.webp`);
    if (!force && await readExisting(output)) {
      statuses[id] = 'existing';
      continue;
    }
    const prompt = buildPrompt(icon);
    try {
      let bytes;
      try {
        bytes = await requestImage({ project, token, model: activeModel, prompt });
      } catch (error) {
        if (error.status !== 429 || activeModel === MODELS[1]) throw error;
        activeModel = MODELS[1];
        console.log(`首選模型配額回應 429，改用 ${activeModel}。`);
        bytes = await requestImage({ project, token, model: activeModel, prompt });
      }
      const webp = await convertToWebp(bytes, output);
      modelByIcon[id] = activeModel;
      statuses[id] = 'generated';
      generated += 1;
      console.log(`生成完成：${path.relative(ROOT, output)}（${webp.length} bytes）`);
    } catch (error) {
      failed += 1;
      statuses[id] = 'failed';
      console.error(`生成失敗：${id}：${error.message}；保留既有資產。`);
    }
  }
  await writeProvenance({ project, modelByIcon, statuses });
  console.log(`Header 圖示 pilot 完成：新增 ${generated}、失敗 ${failed}。`);
  return { generated, failed, project };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('generate-header-icons.mjs')) {
  main().catch((error) => {
    console.error(`Header 圖示 pilot 中止：${error.message}`);
    process.exitCode = 1;
  });
}

export { ICONS, MODELS, buildPrompt, buildRequest, decodeImage, main };
