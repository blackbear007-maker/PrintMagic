/**
 * ImageTool Core Module
 * 移除 AI 假象與 VIP 功能，改以 Canvas + Web Worker 誠實處理圖片
 * @version 2.0.0
 */

(function(global) {
  'use strict';

  const CONSTANTS = {
    FORMATS: ['png', 'jpg'],
    DEFAULT_QUALITY: 95
  };

  // ============================================================
  // Worker 管理
  // ============================================================
  class WorkerManager {
    constructor(scriptUrl = 'image-worker.js') {
      this.worker = null;
      this.scriptUrl = scriptUrl;
      this.pending = new Map();
      this.nextId = 1;
    }

    ensureWorker() {
      if (this.worker) return this.worker;
      try {
        this.worker = new Worker(this.scriptUrl);
        this.worker.onmessage = (e) => this.handleMessage(e);
        this.worker.onerror = (err) => {
          console.error('Worker error:', err);
          this.terminate();
        };
      } catch (e) {
        console.warn('Worker not available:', e);
        this.worker = null;
      }
      return this.worker;
    }

    terminate() {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
    }

    handleMessage(e) {
      const { id, success, error, imageData, result } = e.data;
      const item = this.pending.get(id);
      if (!item) return;
      this.pending.delete(id);
      if (success) {
        if (imageData) {
          item.resolve({ imageData: new ImageData(imageData.data, imageData.width, imageData.height) });
        } else {
          item.resolve(result);
        }
      } else {
        item.reject(new Error(error || 'Worker failed'));
      }
    }

    async run(operation, imageData, extra = {}) {
      if (!this.ensureWorker()) {
        throw new Error('Web Worker not available');
      }
      const id = this.nextId++;
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        this.worker.postMessage({
          id,
          operation,
          payload: { imageData: { width: imageData.width, height: imageData.height, data: imageData.data }, ...extra }
        }, [imageData.data.buffer]);
      });
    }

    isAvailable() {
      return !!this.worker;
    }
  }

  // ============================================================
  // 匯出處理
  // ============================================================
  class ExportManager {
    isValidDataUrl(url) {
      const pattern = /^data:image\/(png|jpeg|jpg|webp|gif|bmp);base64,[A-Za-z0-9+/=]+$/;
      return pattern.test(url);
    }

    convertImageData(imageData, format, quality) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const mime = format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const q = Math.max(0.1, Math.min(1, quality / 100));
            resolve(canvas.toDataURL(mime, mime === 'image/jpeg' ? q : undefined));
          } catch (error) {
            reject(new Error('格式轉換失敗: ' + error.message));
          }
        };
        img.onerror = () => reject(new Error('圖片載入失敗'));
        img.src = imageData;
      });
    }

    async performExport(imageData, settings, callbacks = {}) {
      const { onStart, onSuccess, onError, onComplete } = callbacks;
      try {
        if (!imageData) throw new Error('請先上傳圖片');
        if (!this.isValidDataUrl(imageData)) throw new Error('無效的圖片格式');
        if (onStart) onStart();

        const format = (settings.format || 'png').toLowerCase();
        const quality = settings.quality || CONSTANTS.DEFAULT_QUALITY;
        const ext = format === 'jpg' || format === 'jpeg' ? 'jpg' : 'png';
        const resultData = await this.convertImageData(imageData, format, quality);

        const link = document.createElement('a');
        link.href = resultData;
        link.download = `image-${Date.now()}.${ext}`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => link.remove(), 100);

        if (onSuccess) onSuccess({ format, quality });
        return true;
      } catch (error) {
        console.error('Export error:', error);
        if (onError) onError(error.message);
        return false;
      } finally {
        if (onComplete) onComplete();
      }
    }
  }

  // ============================================================
  // 圖片增強
  // ============================================================
  class ImageEnhancer {
    constructor(workerManager) {
      this.worker = workerManager;
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
    }

    async decodeImageData(imageData) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.canvas.width = img.width;
          this.canvas.height = img.height;
          this.ctx.drawImage(img, 0, 0);
          resolve(this.ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = () => reject(new Error('圖片載入失敗'));
        img.src = imageData;
      });
    }

    encodeImageData(imageData, type = 'image/png', quality) {
      this.canvas.width = imageData.width;
      this.canvas.height = imageData.height;
      this.ctx.putImageData(imageData, 0, 0);
      return this.canvas.toDataURL(type, quality);
    }

    async upscale(imageData, options = {}) {
      const { scale = 2 } = options;
      const imageDataObj = await this.decodeImageData(imageData);
      const result = await this.worker.run('upscale', imageDataObj, { scale });
      return {
        result: this.encodeImageData(result.imageData, 'image/png'),
        method: 'Lanczos + Worker',
        scale
      };
    }

  }



  // ============================================================
  // 印刷適合度評分
  // ============================================================
  class PrintScoreCalculator {
    constructor(workerManager) {
      this.worker = workerManager;
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
    }

    async analyzeImage(imageData) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.canvas.width = img.width;
          this.canvas.height = img.height;
          this.ctx.drawImage(img, 0, 0);
          resolve(this.ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = () => reject(new Error('圖片載入失敗'));
        img.src = imageData;
      });
    }

    detectFormat(dataUrl) {
      if (dataUrl.includes('image/png')) return 'png';
      if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'jpg';
      if (dataUrl.includes('image/webp')) return 'webp';
      return 'unknown';
    }

    async calculate(imageData, preset) {
      const imageDataObj = await this.analyzeImage(imageData);
      const stats = await this.worker.run('analyze', imageDataObj);
      const { width, height, avgLum, avgSat, stdLum, edgeScore, transparentRatio } = stats;

      const targetW = preset.widthPx || Math.round((preset.widthMm || 0) / 25.4 * preset.dpi);
      const targetH = preset.heightPx || Math.round((preset.heightMm || 0) / 25.4 * preset.dpi);
      const targetMax = Math.max(targetW, targetH);
      const actualMax = Math.max(width, height);
      const resolutionRatio = targetMax > 0 ? actualMax / targetMax : 1;
      const resolutionScore = Math.min(1, resolutionRatio);
      const needsUpscale = resolutionRatio < 1;

      const imgAspect = height > 0 ? width / height : 1;
      const targetAspect = targetH > 0 ? targetW / targetH : 1;
      const aspectDiff = Math.max(imgAspect, targetAspect) > 0
        ? Math.abs(imgAspect - targetAspect) / Math.max(imgAspect, targetAspect)
        : 0;
      const aspectScore = Math.max(0, 1 - aspectDiff);

      const brightnessScore = avgLum < 0.15 ? avgLum / 0.15 : avgLum > 0.95 ? (1 - avgLum) / 0.05 : 1;
      const saturationScore = avgSat > 0.85 ? (1 - avgSat) / 0.15 : avgSat < 0.05 ? avgSat / 0.05 : 1;
      const contrastScore = Math.min(1, stdLum * 4);
      const sharpnessScore = Math.min(1, edgeScore * 20);

      const format = this.detectFormat(imageData);
      let formatScore = 1;
      if (format === 'webp') formatScore = 0.4;
      else if (format === 'unknown') formatScore = 0.5;
      if (transparentRatio > 0.05 && preset.bleed === 0) formatScore *= 0.7;

      const weights = {
        resolution: 0.35,
        aspect: 0.15,
        brightness: 0.1,
        saturation: 0.1,
        contrast: 0.1,
        sharpness: 0.1,
        format: 0.1
      };

      const score = Math.round((
        resolutionScore * weights.resolution +
        aspectScore * weights.aspect +
        brightnessScore * weights.brightness +
        saturationScore * weights.saturation +
        contrastScore * weights.contrast +
        sharpnessScore * weights.sharpness +
        formatScore * weights.format
      ) * 100);

      const issues = [];
      if (resolutionRatio < 0.5) issues.push('解析度嚴重不足，建議放大');
      else if (resolutionRatio < 1) issues.push('解析度不足，建議放大');
      if (aspectDiff > 0.1) issues.push('長寬比與目標不同，可能裁切');
      if (avgLum < 0.15) issues.push('畫面偏暗，印刷後可能更暗');
      if (avgLum > 0.95) issues.push('畫面偏亮，細節可能遺失');
      if (avgSat > 0.85) issues.push('色彩過飽和，印刷可能偏色');
      if (avgSat < 0.05) issues.push('色彩過淡，印刷可能偏灰');
      if (stdLum < 0.08) issues.push('對比偏低，印刷可能太平');
      if (edgeScore < 0.02) issues.push('畫面偏糊，建議銳化或換圖');
      if (format === 'webp') issues.push('WebP 格式可能不被印刷店接受，建議轉 PNG/JPG');
      if (transparentRatio > 0.05 && preset.bleed === 0) issues.push('圖片含透明背景，部分流程可能需補白');

      return {
        score: Math.max(0, Math.min(100, score)),
        breakdown: {
          resolution: Math.round(resolutionScore * 100),
          aspect: Math.round(aspectScore * 100),
          brightness: Math.round(brightnessScore * 100),
          saturation: Math.round(saturationScore * 100),
          contrast: Math.round(contrastScore * 100),
          sharpness: Math.round(sharpnessScore * 100),
          format: Math.round(formatScore * 100)
        },
        needsUpscale,
        targetMax,
        actualMax,
        issues,
        stats: { avgLum, avgSat, stdLum, edgeScore, transparentRatio }
      };
    }
  }


  // ============================================================
  // 設定管理
  // ============================================================
  class SettingsManager {
    constructor() {
      this.defaults = { format: 'png', quality: CONSTANTS.DEFAULT_QUALITY };
      this.current = this.loadSettings();
    }

    loadSettings() {
      try {
        const saved = localStorage.getItem('image_tool_settings');
        return saved ? { ...this.defaults, ...JSON.parse(saved) } : { ...this.defaults };
      } catch (e) {
        return { ...this.defaults };
      }
    }

    saveSettings() {
      try {
        localStorage.setItem('image_tool_settings', JSON.stringify(this.current));
      } catch (e) {
        console.warn('Failed to save settings:', e);
      }
    }

    get(key) { return this.current[key]; }
    set(key, value) { this.current[key] = value; this.saveSettings(); }
    getAll() { return { ...this.current }; }
    reset() { this.current = { ...this.defaults }; this.saveSettings(); }
  }

  // ============================================================
  // 公開 API
  // ============================================================
  const workerManager = new WorkerManager();
  const exportManager = new ExportManager();
  const settingsManager = new SettingsManager();
  const imageEnhancer = new ImageEnhancer(workerManager);
  const printScoreCalculator = new PrintScoreCalculator(workerManager);

  const ImageTool = {
    CONSTANTS,
    export: exportManager,
    settings: settingsManager,
    enhance: imageEnhancer,
    exportImage: (imageData, callbacks) => exportManager.performExport(imageData, settingsManager.getAll(), callbacks),
    upscale: (imageData, options) => imageEnhancer.upscale(imageData, options),
    printScore: (imageData, preset) => printScoreCalculator.calculate(imageData, preset),
    init: () => {
      console.log('ImageTool Core initialized (worker-based)');
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageTool;
  } else {
    global.ImageTool = ImageTool;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ImageTool.init);
    } else {
      ImageTool.init();
    }
  }
})(typeof window !== 'undefined' ? window : this);
