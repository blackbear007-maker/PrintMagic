import type {
  ImagePixelStats,
  InkAnalysis,
  WorkerRequest,
  WorkerResponse
} from '../types';
import { LanczosResizer } from '../engines/lanczos';
import { UnsharpMask } from '../core/unsharp-mask';
import { InkLimiter } from '../core/ink-limiter';
import { PrintScoreCalculator } from '../core/print-score';
import { MoireDescreen } from '../core/moire-descreen';
import { JpegDeblockingFilter } from '../core/jpeg-deblocking-filter';

function createClampedImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  const copy = new Uint8ClampedArray(data.length);
  copy.set(data);
  return new ImageData(copy, width, height);
}

/**
 * Type-Safe Worker Client with Fallback
 */
export class WorkerClient {
  private worker: Worker | null = null;
  private pending = new Map<
    string,
    {
      resolve: (res: any) => void;
      reject: (err: Error) => void;
    }
  >();
  private nextId = 1;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(
          new URL('./image.worker.ts', import.meta.url),
          { type: 'module' }
        );
        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          this.handleMessage(e.data);
        };
        this.worker.onerror = (err) => {
          console.warn('Worker error, rejecting pending tasks and fallback to main thread:', err);
          const errorMsg = (err as ErrorEvent)?.message || 'Web Worker crashed during execution';
          // Reject all pending tasks so UI does not hang indefinitely
          for (const [_id, { reject }] of this.pending.entries()) {
            reject(new Error(errorMsg));
          }
          this.pending.clear();
          this.terminate();
        };
      } catch (err) {
        console.warn('Could not initialize Web Worker, using main thread fallback:', err);
        this.worker = null;
      }
    }
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private handleMessage(data: WorkerResponse): void {
    const { id, success, error, imageData, result } = data;
    const item = this.pending.get(id);
    if (!item) return;

    this.pending.delete(id);

    if (success) {
      if (imageData) {
        const out = createClampedImageData(imageData.data, imageData.width, imageData.height);
        item.resolve({ imageData: out, result });
      } else {
        item.resolve(result);
      }
    } else {
      item.reject(new Error(error || 'Worker operation failed'));
    }
  }

  private async postToWorker(
    operation: WorkerRequest['operation'],
    imageData: ImageData,
    extra: Partial<WorkerRequest['payload']> = {}
  ): Promise<any> {
    if (!this.worker) {
      // Main Thread Fallback
      return this.runMainThreadFallback(operation, imageData, extra);
    }

    const id = `op-${this.nextId++}`;
    const copyData = new Uint8ClampedArray(imageData.data);

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const request: WorkerRequest = {
        id,
        operation,
        payload: {
          imageData: {
            width: imageData.width,
            height: imageData.height,
            data: copyData
          },
          ...extra
        }
      };

      this.worker!.postMessage(request, [copyData.buffer]);
    });
  }

  private runMainThreadFallback(
    operation: WorkerRequest['operation'],
    imageData: ImageData,
    extra: Partial<WorkerRequest['payload']>
  ): any {
    switch (operation) {
      case 'lanczos': {
        const scale = extra.scale || 2;
        const res = LanczosResizer.resize(
          imageData.data,
          imageData.width,
          imageData.height,
          scale
        );
        const out = createClampedImageData(res.data, res.width, res.height);
        return { imageData: out };
      }
      case 'unsharp': {
        const sharpened = UnsharpMask.apply(
          imageData,
          extra.amount ?? 1.5,
          extra.radius ?? 1,
          extra.threshold ?? 3
        );
        return { imageData: sharpened };
      }
      case 'clampInk': {
        const clamped = InkLimiter.clampInk(imageData, extra.maxInk ?? 300);
        return {
          imageData: clamped.clampedImageData,
          result: { modifiedPixels: clamped.modifiedPixels }
        };
      }
      case 'generateHeatmap': {
        const heatmap = InkLimiter.generateHeatmap(imageData, extra.maxInk ?? 300);
        return { imageData: heatmap };
      }
      case 'analyze': {
        const stats = PrintScoreCalculator.analyzePixels(imageData);
        const inkAnalysis = InkLimiter.analyze(imageData);
        return { stats, inkAnalysis };
      }
      case 'descreen': {
        const descreened = MoireDescreen.apply(imageData, {
          threshold: extra.threshold,
          radius: extra.radius,
          middle: extra.middle
        });
        return { imageData: descreened };
      }
      case 'deblock': {
        const deblocked = JpegDeblockingFilter.deblock(
          imageData,
          extra.amount ?? 0.6,
          extra.threshold ?? 6
        );
        return { imageData: deblocked };
      }
    }
  }

  public async lanczos(imageData: ImageData, scale: number): Promise<ImageData> {
    const res = await this.postToWorker('lanczos', imageData, { scale });
    return res.imageData;
  }

  public async unsharp(
    imageData: ImageData,
    amount = 1.5,
    radius = 1,
    threshold = 3
  ): Promise<ImageData> {
    const res = await this.postToWorker('unsharp', imageData, { amount, radius, threshold });
    return res.imageData;
  }

  public async clampInk(
    imageData: ImageData,
    maxInk = 300
  ): Promise<{ imageData: ImageData; modifiedPixels: number }> {
    const res = await this.postToWorker('clampInk', imageData, { maxInk });
    return {
      imageData: res.imageData,
      modifiedPixels: res.result?.modifiedPixels || 0
    };
  }

  public async generateHeatmap(imageData: ImageData, maxInk = 300): Promise<ImageData> {
    const res = await this.postToWorker('generateHeatmap', imageData, { maxInk });
    return res.imageData;
  }

  public async analyze(
    imageData: ImageData
  ): Promise<{ stats: ImagePixelStats; inkAnalysis: InkAnalysis }> {
    return this.postToWorker('analyze', imageData);
  }

  public async descreen(
    imageData: ImageData,
    threshold?: number,
    radius?: number,
    middle?: number
  ): Promise<ImageData> {
    const res = await this.postToWorker('descreen', imageData, { threshold, radius, middle });
    return res.imageData;
  }

  public async deblock(
    imageData: ImageData,
    strength = 0.6,
    artifactThreshold = 6
  ): Promise<ImageData> {
    const res = await this.postToWorker('deblock', imageData, {
      amount: strength,
      threshold: artifactThreshold
    });
    return res.imageData;
  }
}

export const workerClient = new WorkerClient();
