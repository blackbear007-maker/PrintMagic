import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Pure Node.js PNG Encoder using built-in zlib (No heavy external dependencies)
 */
function createPngBuffer(width: number, height: number, rgbaBuffer: Buffer): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // color type 6: RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Scanlines with filter byte 0 (None)
  const rawScanlines = Buffer.alloc(height * (width * 4 + 1));
  let rawOffset = 0;
  let rgbaOffset = 0;

  for (let y = 0; y < height; y++) {
    rawScanlines[rawOffset++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      rawScanlines[rawOffset++] = rgbaBuffer[rgbaOffset++]; // R
      rawScanlines[rawOffset++] = rgbaBuffer[rgbaOffset++]; // G
      rawScanlines[rawOffset++] = rgbaBuffer[rgbaOffset++]; // B
      rawScanlines[rawOffset++] = rgbaBuffer[rgbaOffset++]; // A
    }
  }

  const compressedData = zlib.deflateSync(rawScanlines);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crc = crc32(crcPayload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

// CRC32 table & calculation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Ensure test-assets directory exists
const outputDir = path.resolve(process.cwd(), 'test-assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

interface SampleMeta {
  id: string;
  name: string;
  filename: string;
  width: number;
  height: number;
  description: string;
  targetPreset: string;
}

const SAMPLES: SampleMeta[] = [
  {
    id: 'sample-01',
    name: '賽博龐克霓虹夜景海報 (Cyberpunk Neon Poster)',
    filename: '01_cyberpunk_neon_poster.png',
    width: 600,
    height: 900,
    description: '超高飽和螢光色、局部墨量高達 340%，解析度需 2.5x 放大',
    targetPreset: 'poster-a4'
  },
  {
    id: 'sample-02',
    name: '北歐水彩山巒展覽大圖 (Watercolor Mountain A3)',
    filename: '02_watercolor_mountain_a3.png',
    width: 960,
    height: 540,
    description: '柔和擴散水彩漸層，邊緣需 USM 銳化補償，橫向 A3 比例',
    targetPreset: 'poster-a3'
  },
  {
    id: 'sample-03',
    name: '極簡黑金商業名片 (Minimalist Gold Business Card)',
    filename: '03_minimalist_business_card.png',
    width: 500,
    height: 300,
    description: '高反差黑底金字幾何名片，需檢驗 3mm 出血與安全框',
    targetPreset: 'business-card'
  },
  {
    id: 'sample-04',
    name: '暗黑奇幻油畫 (Dark Fantasy Oil Painting)',
    filename: '04_dark_fantasy_oil_painting.png',
    width: 768,
    height: 768,
    description: '暗部平均亮度低於 0.14，需防止印刷吸墨死黑與斷階',
    targetPreset: 'postcard'
  },
  {
    id: 'sample-05',
    name: '動漫可愛角色模切貼紙 (Anime Chibi Sticker)',
    filename: '05_anime_chibi_sticker.png',
    width: 400,
    height: 400,
    description: '純白背景高對比圓形線條，50mm 模切貼紙規格',
    targetPreset: 'sticker'
  },
  {
    id: 'sample-06',
    name: '古典植物花卉藝術明信片 (Botanical Flower Postcard)',
    filename: '06_botanical_flower_postcard.png',
    width: 740,
    height: 500,
    description: '精緻花草紋理，3:2 標準明信片黃金長寬比',
    targetPreset: 'postcard'
  },
  {
    id: 'sample-07',
    name: '80年代復古合成波日落 (Retro Synthwave Sunset)',
    filename: '07_retro_synthwave_sunset.png',
    width: 640,
    height: 640,
    description: '紫紅與螢光黃高飽和漸層，需 CMYK 軟打樣色域校正',
    targetPreset: 'poster-a4'
  },
  {
    id: 'sample-08',
    name: '黑白水墨龍紋插畫 (Monochrome Ink Dragon)',
    filename: '08_monochrome_ink_sketch.png',
    width: 600,
    height: 800,
    description: '高反差黑白水墨線條，極度適合 Potrace 向量 SVG 轉換',
    targetPreset: 'poster-a4'
  },
  {
    id: 'sample-09',
    name: '現代建築透視藍圖 (Architectural Perspective Blueprint)',
    filename: '09_architectural_blueprint.png',
    width: 800,
    height: 450,
    description: '深藍色幾何格線與細緻軸測圖，需 Lanczos-3 保留細線',
    targetPreset: 'poster-a3'
  },
  {
    id: 'sample-10',
    name: '黃金光影人像攝影 (Golden Hour Portrait)',
    filename: '10_golden_hour_portrait.png',
    width: 512,
    height: 768,
    description: 'Midjourney 典型人像高光與暖色調，檢驗皮膚色調過渡',
    targetPreset: 'poster-a4'
  }
];

function generatePixels(sample: SampleMeta): Buffer {
  const { width, height, id } = sample;
  const buf = Buffer.alloc(width * height * 4);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      let r = 0, g = 0, b = 0, a = 255;

      switch (id) {
        case 'sample-01': { // Cyberpunk Neon
          r = Math.floor(Math.sin(nx * 8 + ny * 4) * 127 + 128);
          g = Math.floor(Math.cos(ny * 12) * 50);
          b = Math.floor(220 + Math.sin(nx * 6) * 35);
          // Dark high-TAC region
          if (ny > 0.6) {
            r = 25; g = 10; b = 35; // Heavy black with tint
          }
          break;
        }
        case 'sample-02': { // Watercolor Mountain
          const wave = Math.sin(nx * 6) * 0.15 + Math.cos(nx * 14) * 0.05;
          if (ny > 0.5 + wave) {
            r = Math.floor(80 + (ny - 0.5) * 80);
            g = Math.floor(130 + (ny - 0.5) * 60);
            b = Math.floor(120 + (ny - 0.5) * 40);
          } else {
            r = Math.floor(220 - ny * 60);
            g = Math.floor(235 - ny * 40);
            b = Math.floor(245 - ny * 20);
          }
          break;
        }
        case 'sample-03': { // Minimalist Black Gold
          r = 20; g = 20; b = 24; // Deep Space Gray
          const dist = Math.hypot(nx - 0.5, ny - 0.5);
          if (dist < 0.25 && dist > 0.23) {
            r = 212; g = 175; b = 55; // Gold ring
          } else if (dist < 0.08) {
            r = 212; g = 175; b = 55; // Gold center dot
          }
          break;
        }
        case 'sample-04': { // Dark Fantasy
          r = Math.floor(ny * 40 + Math.sin(nx * 10) * 15);
          g = Math.floor(ny * 25);
          b = Math.floor(ny * 50 + 10);
          if (Math.hypot(nx - 0.5, ny - 0.4) < 0.15) {
            r = 220; g = 140; b = 30; // Glowing crystal
          }
          break;
        }
        case 'sample-05': { // Anime Chibi Sticker
          r = 255; g = 255; b = 255; // White paper
          const dist = Math.hypot(nx - 0.5, ny - 0.5);
          if (dist < 0.35) {
            r = 255; g = 140; b = 170; // Pink character head
            if (dist > 0.33) {
              r = 40; g = 40; b = 45; // Dark outline
            }
          }
          break;
        }
        case 'sample-06': { // Botanical Floral
          r = Math.floor(240 - nx * 30);
          g = Math.floor(245 - ny * 20);
          b = Math.floor(235 - (nx + ny) * 15);
          const leaf = Math.sin(nx * 20) * Math.cos(ny * 20);
          if (leaf > 0.4) {
            r = 65; g = 120; b = 75; // Green leaf
          } else if (leaf > 0.25) {
            r = 180; g = 80; b = 90; // Flower petal
          }
          break;
        }
        case 'sample-07': { // Retro Synthwave
          r = Math.floor(255 * (1 - ny));
          g = Math.floor(50 + ny * 60);
          b = Math.floor(180 + ny * 75);
          // Grid lines
          if (ny > 0.5 && (Math.floor(y / 15) % 2 === 0 || Math.floor((x - width/2) / (y * 0.05 + 1)) % 10 === 0)) {
            r = 0; g = 255; b = 240; // Cyan grid
          }
          break;
        }
        case 'sample-08': { // Monochrome Ink
          const noise = Math.sin(nx * 30 + Math.cos(ny * 20) * 4) + Math.cos(ny * 30);
          if (noise > 0.3) {
            r = 15; g = 15; b = 18; // Deep black ink
          } else {
            r = 248; g = 246; b = 242; // Rice paper white
          }
          break;
        }
        case 'sample-09': { // Blueprint
          r = 12; g = 45; b = 110; // Blueprint Blue
          if (x % 20 === 0 || y % 20 === 0) {
            r = 35; g = 85; b = 175; // Grid
          }
          if (Math.abs(x - y) < 2 || Math.abs(x + y - width) < 2) {
            r = 255; g = 255; b = 255; // White line
          }
          break;
        }
        case 'sample-10': { // Golden Hour Portrait
          r = Math.floor(240 - ny * 80);
          g = Math.floor(170 - ny * 70);
          b = Math.floor(110 - ny * 60);
          const face = Math.hypot((nx - 0.5) * 1.3, ny - 0.45);
          if (face < 0.25) {
            r = Math.floor(250 - face * 100);
            g = Math.floor(190 - face * 80);
            b = Math.floor(150 - face * 60);
          }
          break;
        }
      }

      buf[offset++] = Math.max(0, Math.min(255, r));
      buf[offset++] = Math.max(0, Math.min(255, g));
      buf[offset++] = Math.max(0, Math.min(255, b));
      buf[offset++] = a;
    }
  }

  return buf;
}

console.log('🎨 Generating 10 professional AI test artworks for PrintMagic Studio...');

const manifest: any[] = [];

for (const sample of SAMPLES) {
  const pixels = generatePixels(sample);
  const pngBuf = createPngBuffer(sample.width, sample.height, pixels);
  const filePath = path.join(outputDir, sample.filename);
  fs.writeFileSync(filePath, pngBuf);

  const base64 = pngBuf.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  manifest.push({
    ...sample,
    dataUrl,
    sizeBytes: pngBuf.length
  });

  console.log(` ✓ [${sample.id}] ${sample.name} (${sample.width}x${sample.height}px) -> ${sample.filename}`);
}

const manifestPath = path.join(outputDir, 'samples-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`\n✨ Successfully generated all 10 test images in ${outputDir}`);
