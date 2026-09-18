#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'xiaoxiang');
const PROVENANCE_PATH = path.join(OUTPUT_DIR, 'avatar-provenance.json');
const LEGACY_REFERENCE = path.join(ROOT, 'public', 'xiaoxiang.jpg');
const MOTHER_REFERENCE = path.resolve(ROOT, '..', 'bike-training', '小象', '小象.png');
const MODELS = ['gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'];
const ENDPOINT_BASE = 'https://aiplatform.googleapis.com/v1beta1/projects';
const STATES = ['idle', 'hello', 'think', 'thumbs', 'cheer'];
const ASSETS = STATES.flatMap((state) => [state, `${state}-blink`]);

const COMMON_LOCK = [
  'the exact same young adult male Xiao-Xiang character from the supplied reference images',
  'approximately 28 to 32 years old, clean smooth youthful face, no wrinkles, no stubble, no aged facial proportions',
  'blond high samurai bun with neat sides, calm reliable slightly lazy personality, refined anime game character proportions',
  'mist-blue knit sweater with visible soft knit texture and khaki casual trousers, completely ordinary everyday streetwear',
  'premium polished 2D character illustration matching the youthful high-finish style of the DownStairs companion apps, crisp dark linework, restrained cel shading, natural warm skin tones',
].join(', ');

const NEGATIVE_LOCK = [
  'no sunglasses, no eyeglasses, no hat, no backpack, no shoulder bag, no jewelry, no badge',
  'no cycling jersey, no cycling shorts, no bicycle, no helmet, no sportswear, no gym uniform, no gym equipment',
  'no logo, no brand, no readable text, no watermark, no interface, no extra person, no extra limbs, no duplicated hands',
].join(', ');

const STATE_PROMPTS = {
  idle: 'quiet idle portrait, looking toward the user with a dry relaxed expression and a tiny closed-mouth half-smile, shoulders loose',
  hello: 'friendly greeting portrait, looking toward the user and giving a small low-energy wave with one hand, understated and natural',
  think: 'thoughtful portrait while inspecting an image, eyes shifted slightly to the side, one finger lightly touching the chin, no prop',
  thumbs: 'restrained approval portrait, giving a small thumbs-up close to the chest, calm expression that says “可以” without a broad grin',
  cheer: 'quiet success portrait after a print export completed, a small contained fist lift and a subtle pleased smile, never an exaggerated celebration',
};

const BLINK_PROMPT = 'same exact pose and framing, eyelids naturally closed for a brief blink, facial identity and clothing unchanged';

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

async function readReference(file) {
  try {
    const bytes = await fs.readFile(file);
    if (bytes.length <= 1024) return null;
    const extension = path.extname(file).toLowerCase();
    const mimeType = extension === '.jpg' || extension === '.jpeg'
      ? 'image/jpeg'
      : extension === '.webp' ? 'image/webp' : 'image/png';
    return { file, mimeType, data: bytes.toString('base64') };
  } catch {
    return null;
  }
}

function buildPrompt(state, blink) {
  const scene = STATE_PROMPTS[state];
  const blinkLine = blink ? BLINK_PROMPT : 'eyes open naturally with a readable calm expression';
  return [
    'Create one square 1:1 avatar illustration for the PrintMagic 印象魔法 assistant.',
    COMMON_LOCK + '.',
    `Show this state: ${scene}.`,
    blinkLine + '.',
    'Use a softly blurred low-contrast blue-grey and warm-grey everyday street or indoor background; no magical effects and no workplace setting.',
    'Keep the character centered, upper-body portrait, head and shoulders occupying about 78 to 86 percent of the canvas, with the same crop and eye line in every state.',
    NEGATIVE_LOCK + '.',
  ].join(' ');
}

function buildRequest(prompt, references) {
  return {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        ...references.map(({ mimeType, data }) => ({ inlineData: { mimeType, data } })),
      ],
    }],
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

async function requestImage({ project, token, model, prompt, references }) {
  const endpoint = `${ENDPOINT_BASE}/${encodeURIComponent(project)}/locations/global/publishers/google/models/${model}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequest(prompt, references)),
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

const PYTHON_TO_WEBP = `
from PIL import Image
import sys

source, target = sys.argv[1], sys.argv[2]
with Image.open(source) as image:
    image.convert('RGBA').save(target, 'WEBP', quality=92, method=6)
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

async function writeProvenance({ project, modelByAsset, statuses }) {
  const assets = {};
  for (const id of ASSETS) {
    const file = path.join(OUTPUT_DIR, `${id}.webp`);
    const bytes = await readExisting(file);
    assets[id] = {
      file: `public/xiaoxiang/${id}.webp`,
      status: statuses[id] || (bytes ? 'existing' : 'pending'),
      model: modelByAsset[id] || null,
      bytes: bytes?.length || null,
      sha256: bytes ? crypto.createHash('sha256').update(bytes).digest('hex') : null,
    };
  }
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(PROVENANCE_PATH, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    provider: 'Google Cloud Vertex AI',
    deliveryFormat: 'RGBA WebP with transparent background',
    backgroundTreatment: 'background-extraction edit; preserve character silhouette and expression',
    project,
    preferredModel: MODELS[0],
    fallbackModel: MODELS[1],
    characterReference: path.relative(ROOT, MOTHER_REFERENCE).replaceAll(path.sep, '/'),
    characterLock: `${COMMON_LOCK}. ${NEGATIVE_LOCK}.`,
    assets,
  }, null, 2)}\n`);
}

function selectedIds() {
  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length).trim();
  if (!only) return ASSETS;
  if (!ASSETS.includes(only)) throw new Error(`找不到指定頭像狀態：${only}`);
  return [only];
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const refreshProvenance = process.argv.includes('--refresh-provenance');
  const force = process.argv.includes('--force');
  const ids = selectedIds();
  const project = await resolveProject();
  const reference = await readReference((await fs.stat(MOTHER_REFERENCE).catch(() => null)) ? MOTHER_REFERENCE : LEGACY_REFERENCE);
  if (refreshProvenance) {
    await writeProvenance({ project, modelByAsset: {}, statuses: {} });
    console.log(`已刷新小象頭像 provenance：${path.relative(ROOT, PROVENANCE_PATH)}`);
    return { generated: 0, failed: 0, project };
  }
  const tokenAvailable = dryRun ? Boolean(project && await resolveToken().then(() => true).catch(() => false)) : false;

  console.log(`小象生活系頭像${dryRun ? ' dry-run' : ''}：${ids.length} 張；首選模型 ${MODELS[0]}；fallback ${MODELS[1]}`);
  console.log(`Google Cloud project：${project || '未設定'}；access token：${dryRun ? (tokenAvailable ? '可用' : '不可用') : '待生成時取得'}`);
  console.log(`角色參考圖：${reference ? path.relative(ROOT, reference.file) : '不可用'}`);
  ids.forEach((id) => console.log(`- ${id}: ${path.relative(ROOT, path.join(OUTPUT_DIR, `${id}.webp`))}`));
  if (dryRun) return { generated: 0, failed: 0, pending: !project || !tokenAvailable || !reference };
  if (!project) {
    console.log('未生成小象生活系頭像：Google Cloud project 未設定，保留既有資產。');
    await writeProvenance({ project: '', modelByAsset: {}, statuses: {} });
    return { generated: 0, failed: 0, pending: true };
  }
  if (!reference) {
    console.log('未生成小象生活系頭像：找不到角色參考圖，保留既有資產。');
    await writeProvenance({ project, modelByAsset: {}, statuses: {} });
    return { generated: 0, failed: 0, pending: true };
  }

  let token;
  try {
    token = await resolveToken();
  } catch (error) {
    console.log(`未生成小象生活系頭像：${error.message}，保留既有資產。`);
    await writeProvenance({ project, modelByAsset: {}, statuses: {} });
    return { generated: 0, failed: 0, pending: true };
  }

  const modelByAsset = {};
  const statuses = {};
  let activeModel = MODELS[0];
  let generated = 0;
  let failed = 0;
  let master = await readReference(path.join(OUTPUT_DIR, 'idle.webp'));

  for (const id of ids) {
    const output = path.join(OUTPUT_DIR, `${id}.webp`);
    if (!force && await readExisting(output)) {
      statuses[id] = 'existing';
      if (id === 'idle') master = await readReference(output);
      continue;
    }
    const [state, blinkSuffix] = id.split('-');
    const prompt = buildPrompt(state, blinkSuffix === 'blink');
    const references = [reference];
    if (master) references.unshift(master);
    try {
      let bytes;
      try {
        bytes = await requestImage({ project, token, model: activeModel, prompt, references });
      } catch (error) {
        if (error.status !== 429 || activeModel === MODELS[1]) throw error;
        activeModel = MODELS[1];
        console.log(`首選模型配額回應 429，改用 ${activeModel}。`);
        bytes = await requestImage({ project, token, model: activeModel, prompt, references });
      }
      const webp = await convertToWebp(bytes, output);
      modelByAsset[id] = activeModel;
      statuses[id] = 'generated';
      generated += 1;
      if (id === 'idle') master = { file: output, mimeType: 'image/webp', data: webp.toString('base64') };
      console.log(`生成完成：${path.relative(ROOT, output)}（${webp.length} bytes）`);
    } catch (error) {
      failed += 1;
      statuses[id] = 'failed';
      console.error(`生成失敗：${id}：${error.message}；保留既有資產。`);
    }
  }
  await writeProvenance({ project, modelByAsset, statuses });
  console.log(`小象生活系頭像完成：新增 ${generated}、失敗 ${failed}。`);
  return { generated, failed, project };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('generate-xiaoxiang-lifestyle-assets.mjs')) {
  main().catch((error) => {
    console.error(`小象生活系頭像生成中止：${error.message}`);
    process.exitCode = 1;
  });
}

export {
  ASSETS,
  MODELS,
  STATES,
  buildPrompt,
  buildRequest,
  decodeImage,
  main,
};
