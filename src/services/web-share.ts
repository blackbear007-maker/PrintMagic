import { Toast } from '../ui/toast';
import { SoundEffects } from '../core/sound-effects';

export class WebShareService {
  /**
   * Check if Native Web Share with Files is supported in the current browser
   */
  public static canShareFiles(file: File): boolean {
    if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
      return false;
    }
    try {
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  }

  /**
   * Share a File via Native System Sheet (AirDrop / LINE / WhatsApp / Files / Print)
   * Returns true if shared successfully, false if cancelled or unsupported
   */
  public static async shareFile(
    file: File,
    title: string = 'PrintMagic 印刷標準檔',
    text: string = '已完成 300 DPI 印刷最佳化準備的檔案'
  ): Promise<boolean> {
    if (!this.canShareFiles(file)) {
      return false;
    }

    try {
      SoundEffects.shutterClick();
      await navigator.share({
        title,
        text,
        files: [file]
      });
      Toast.success('✓ 分享成功！');
      return true;
    } catch (err: any) {
      // User aborted share sheet or cancelled
      if (err?.name === 'AbortError') {
        return false;
      }
      console.warn('Web Share failed, falling back to download:', err);
      return false;
    }
  }

  /**
   * Convert Data URL or Blob to File object for sharing
   */
  public static async dataUrlToFile(dataUrl: string, fileName: string, mimeType: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], fileName, { type: mimeType });
  }

  /**
   * Convert Uint8Array (like generated PDF) to File object
   */
  public static uint8ArrayToFile(data: Uint8Array, fileName: string, mimeType = 'application/pdf'): File {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
    return new File([blob], fileName, { type: mimeType });
  }
}
