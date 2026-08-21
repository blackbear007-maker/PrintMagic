import { Toast } from './toast';
import { store } from './state';

export interface LoadedImageResult {
  file: File;
  dataUrl: string;
  img: HTMLImageElement;
}

export type MultiFileLoadHandler = (results: LoadedImageResult[]) => void;

/**
 * DropZone Component with Multi-Format Batch Support (Max 20 Images) and Direct Clipboard Paste (Ctrl+V)
 */
export class DropZone {
  public static readonly MAX_BATCH_LIMIT = 20;

  private el: HTMLElement;
  private fileInput: HTMLInputElement;
  private onFilesLoaded: MultiFileLoadHandler;

  constructor(elementId: string, onFilesLoaded: MultiFileLoadHandler) {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Dropzone element #${elementId} not found`);
    }
    this.el = element;
    this.onFilesLoaded = onFilesLoaded;

    // Create hidden multi-file input
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.multiple = true;
    this.fileInput.accept = 'image/png,image/jpeg,image/jpg,image/webp,image/bmp,image/gif,image/heic,image/avif';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    this.bindEvents();
  }

  public openFilePicker(): void {
    this.fileInput.value = '';
    this.fileInput.click();
  }

  private bindEvents(): void {
    // Click to select
    this.el.addEventListener('click', () => {
      this.openFilePicker();
    });

    this.fileInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        this.handleFiles(Array.from(target.files));
      }
    });

    // Drag and Drop
    this.el.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.el.classList.add('pm-dropzone-dragover');
    });

    this.el.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.el.classList.remove('pm-dropzone-dragover');
    });

    this.el.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.el.classList.remove('pm-dropzone-dragover');

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        this.handleFiles(Array.from(e.dataTransfer.files));
      }
    });

    // Global Paste Support (Ctrl+V / Cmd+V)
    window.addEventListener('paste', (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }

      if (pastedFiles.length > 0) {
        Toast.info(`✦ 已從剪貼簿讀取 ${pastedFiles.length} 張圖片`);
        this.handleFiles(pastedFiles);
      }
    });
  }

  public async handleFiles(files: File[]): Promise<void> {
    let validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      Toast.error('請上傳有效的圖片檔案 (PNG, JPG, WebP 等)');
      return;
    }

    // Enforce 20-image maximum batch limit
    const currentCount = store.getState().batchItems.length;
    const availableSlots = DropZone.MAX_BATCH_LIMIT - currentCount;

    if (availableSlots <= 0) {
      Toast.warning(`⚠️ 批次處理已達上限 (最多 ${DropZone.MAX_BATCH_LIMIT} 張作品)，請先移除部分作品`);
      return;
    }

    if (validFiles.length > availableSlots) {
      Toast.warning(`⚠️ 批次處理上限為 ${DropZone.MAX_BATCH_LIMIT} 張，已自動為您載入前 ${availableSlots} 張作品`);
      validFiles = validFiles.slice(0, availableSlots);
    }

    const loadPromises = validFiles.map((file) => {
      return new Promise<LoadedImageResult | null>((resolve) => {
        if (file.size > 100 * 1024 * 1024) {
          Toast.error(`${file.name}: 檔案大小超出 100MB 上限`);
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (!dataUrl) {
            resolve(null);
            return;
          }

          const img = new Image();
          img.onload = () => {
            resolve({ file, dataUrl, img });
          };
          img.onerror = () => {
            Toast.error(`${file.name}: 無法解碼此圖片檔案`);
            resolve(null);
          };
          img.src = dataUrl;
        };
        reader.onerror = () => {
          Toast.error(`${file.name}: 讀取檔案失敗`);
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    });

    const results = (await Promise.all(loadPromises)).filter(
      (r): r is LoadedImageResult => r !== null
    );

    if (results.length > 0) {
      this.onFilesLoaded(results);
    }
  }
}
