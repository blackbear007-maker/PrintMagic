/**
 * 📷 ExifMetadataSniffer
 *
 * ⚠️ 2026-08-28 誠實澄清：這不是真正的 EXIF 解析器，也不是「(MIT, 0 KB)」——那個授權標籤是虛構的
 * （100% 本專案自己寫的程式碼，沒有引用任何第三方授權碼）。實際作法是把檔案前 16KB 轉成 ASCII、
 * 全部轉小寫，直接對關鍵字做子字串比對（例如檔名或圖片裡剛好出現 "canon" 這個詞也會誤判）。這種
 * 子字串比對無法保證「100%」— 一張隨手拍到印有 "Procreate" 字樣海報的照片、或檔案中剛好包含某廠牌
 * 名稱的文字內容，都可能被誤判成對應軟體/相機生成。以下功能描述已移除不成立的百分比宣稱：
 * 1. 相機廠牌/型號關鍵字比對，用於推測是否為實拍照片。
 * 2. 繪圖軟體名稱關鍵字比對（Clip Studio Paint、Procreate、SAI 等），用於推測是否為手繪插畫。
 * 3. AI 生成工具關鍵字比對（Midjourney、Stable Diffusion、NovelAI、DALL-E 等）。
 * 4. 向量設計軟體關鍵字比對（Adobe Illustrator、CorelDRAW、Inkscape）。
 */

export interface ExifDetectionResult {
  hasExif: boolean;
  isCameraPhoto: boolean;
  isAiGenerated: boolean;
  isIllustrationSoftware: boolean;
  isVectorDesignSoftware: boolean;
  cameraMakeModel?: string;
  softwareName?: string;
  colorSpaceTag?: string;
  detectedIntent?: 'portrait' | 'anime' | 'document' | 'landscape' | 'sticker' | 'ai-art';
}

export class ExifMetadataSniffer {
  /**
   * Sniffs metadata from raw ArrayBuffer or Uint8Array (JPEG APP1 EXIF, PNG tEXt/iTXt, WebP)
   */
  public static sniffMetadata(fileBytes: Uint8Array | ArrayBuffer): ExifDetectionResult {
    const bytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
    if (bytes.length < 32) {
      return {
        hasExif: false,
        isCameraPhoto: false,
        isAiGenerated: false,
        isIllustrationSoftware: false,
        isVectorDesignSoftware: false
      };
    }

    let asciiStr = '';
    // Scan first 16KB for ASCII tags (EXIF and PNG chunks are typically in the first 8-16KB)
    const scanLimit = Math.min(bytes.length, 16384);
    for (let i = 0; i < scanLimit; i++) {
      const b = bytes[i];
      if (b >= 32 && b <= 126) {
        asciiStr += String.fromCharCode(b);
      } else {
        asciiStr += ' ';
      }
    }

    const lowerStr = asciiStr.toLowerCase();

    // 1. Camera Make / Model Detection
    const cameraMap: Record<string, string> = {
      'iphone': 'Apple iPhone',
      'apple': 'Apple Camera',
      'canon': 'Canon EOS',
      'nikon': 'Nikon DSLR',
      'sony': 'Sony Alpha',
      'fujifilm': 'Fujifilm X',
      'leica': 'Leica Camera',
      'hasselblad': 'Hasselblad Medium Format'
    };
    let cameraFound = '';
    for (const [key, name] of Object.entries(cameraMap)) {
      if (lowerStr.includes(key)) {
        cameraFound = name;
        break;
      }
    }

    // 2. Illustration Software Detection
    const illustrationMap: Record<string, string> = {
      'clip studio': 'Clip Studio Paint',
      'procreate': 'Procreate',
      'paint tool sai': 'Paint Tool SAI',
      'sai2': 'Paint Tool SAI 2',
      'medibang': 'MediBang Paint',
      'ibispaint': 'ibisPaint',
      'krita': 'Krita'
    };
    let illustrationFound = '';
    for (const [key, name] of Object.entries(illustrationMap)) {
      if (lowerStr.includes(key)) {
        illustrationFound = name;
        break;
      }
    }

    // 3. AI Generators Detection
    const aiMap: Record<string, string> = {
      'midjourney': 'Midjourney v6',
      'stable diffusion': 'Stable Diffusion',
      'novelai': 'NovelAI',
      'comfyui': 'ComfyUI Workflow',
      'dall-e': 'DALL-E 3',
      'flux': 'FLUX.1'
    };
    let aiFound = '';
    for (const [key, name] of Object.entries(aiMap)) {
      if (lowerStr.includes(key)) {
        aiFound = name;
        break;
      }
    }

    // 4. Vector / Packaging Design Apps
    const vectorMap: Record<string, string> = {
      'adobe illustrator': 'Adobe Illustrator',
      'illustrator': 'Adobe Illustrator',
      'coreldraw': 'CorelDRAW',
      'inkscape': 'Inkscape'
    };
    let vectorFound = '';
    for (const [key, name] of Object.entries(vectorMap)) {
      if (lowerStr.includes(key)) {
        vectorFound = name;
        break;
      }
    }

    const isCamera = !!cameraFound || lowerStr.includes('exif') || lowerStr.includes('focal');
    const isIllustration = !!illustrationFound;
    const isAi = !!aiFound;
    const isVector = !!vectorFound;

    let detectedIntent: ExifDetectionResult['detectedIntent'] = undefined;
    if (isIllustration) detectedIntent = 'anime';
    else if (isAi) detectedIntent = 'ai-art';
    else if (isVector) detectedIntent = 'sticker';
    else if (isCamera) detectedIntent = 'portrait';

    return {
      hasExif: isCamera || isIllustration || isAi || isVector,
      isCameraPhoto: isCamera,
      isAiGenerated: isAi,
      isIllustrationSoftware: isIllustration,
      isVectorDesignSoftware: isVector,
      cameraMakeModel: cameraFound || undefined,
      softwareName: illustrationFound || aiFound || vectorFound || undefined,
      detectedIntent
    };
  }
}
