import { LanczosResizer } from '../engines/lanczos';
import { UnsharpMask } from '../core/unsharp-mask';
import { InkLimiter } from '../core/ink-limiter';
import { PrintScoreCalculator } from '../core/print-score';
import { MoireDescreen } from '../core/moire-descreen';
import { JpegDeblockingFilter } from '../core/jpeg-deblocking-filter';
import type { WorkerRequest, WorkerResponse } from '../types';

function wrapImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  return {
    data,
    width,
    height,
    colorSpace: 'srgb'
  } as ImageData;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, operation, payload } = e.data;

  try {
    const { imageData } = payload;
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;
    const srcData = imageData.data;

    let response: WorkerResponse;

    switch (operation) {
      case 'lanczos': {
        const scale = payload.scale || 2;
        const res = LanczosResizer.resize(srcData, srcWidth, srcHeight, scale);
        response = {
          id,
          success: true,
          imageData: {
            width: res.width,
            height: res.height,
            data: res.data
          }
        };
        // Transfer buffer
        self.postMessage(response, [res.data.buffer]);
        return;
      }

      case 'unsharp': {
        const amount = payload.amount ?? 1.5;
        const radius = payload.radius ?? 1;
        const threshold = payload.threshold ?? 3;
        const imgObj = wrapImageData(srcData, srcWidth, srcHeight);
        const sharpened = UnsharpMask.apply(imgObj, amount, radius, threshold);

        response = {
          id,
          success: true,
          imageData: {
            width: sharpened.width,
            height: sharpened.height,
            data: sharpened.data
          }
        };
        self.postMessage(response, [sharpened.data.buffer]);
        return;
      }

      case 'clampInk': {
        const maxInk = payload.maxInk ?? 300;
        const imgObj = wrapImageData(srcData, srcWidth, srcHeight);
        const clamped = InkLimiter.clampInk(imgObj, maxInk);

        response = {
          id,
          success: true,
          result: { modifiedPixels: clamped.modifiedPixels },
          imageData: {
            width: clamped.clampedImageData.width,
            height: clamped.clampedImageData.height,
            data: clamped.clampedImageData.data
          }
        };
        self.postMessage(response, [clamped.clampedImageData.data.buffer]);
        return;
      }

      case 'generateHeatmap': {
        const maxInk = payload.maxInk ?? 300;
        const imgObj = wrapImageData(srcData, srcWidth, srcHeight);
        const heatmap = InkLimiter.generateHeatmap(imgObj, maxInk);

        response = {
          id,
          success: true,
          imageData: {
            width: heatmap.width,
            height: heatmap.height,
            data: heatmap.data
          }
        };
        self.postMessage(response, [heatmap.data.buffer]);
        return;
      }

      case 'descreen': {
        const imgObj = wrapImageData(srcData, srcWidth, srcHeight);
        const descreened = MoireDescreen.apply(imgObj, {
          threshold: payload.threshold,
          radius: payload.radius,
          middle: payload.middle
        });

        response = {
          id,
          success: true,
          imageData: {
            width: descreened.width,
            height: descreened.height,
            data: descreened.data
          }
        };
        self.postMessage(response, [descreened.data.buffer]);
        return;
      }

      case 'deblock': {
        const strength = payload.amount ?? 0.6;
        const artifactThreshold = payload.threshold ?? 6;
        const imgObj = wrapImageData(srcData, srcWidth, srcHeight);
        const deblocked = JpegDeblockingFilter.deblock(imgObj, strength, artifactThreshold);

        response = {
          id,
          success: true,
          imageData: {
            width: deblocked.width,
            height: deblocked.height,
            data: deblocked.data
          }
        };
        self.postMessage(response, [deblocked.data.buffer]);
        return;
      }

      case 'analyze': {
        const imgObj = wrapImageData(srcData, srcWidth, srcHeight);
        const stats = PrintScoreCalculator.analyzePixels(imgObj);
        const inkAnalysis = InkLimiter.analyze(imgObj);

        response = {
          id,
          success: true,
          result: {
            stats,
            inkAnalysis
          }
        };
        self.postMessage(response);
        return;
      }

      default:
        throw new Error(`Unknown worker operation: ${operation}`);
    }
  } catch (error: any) {
    const errorResponse: WorkerResponse = {
      id,
      success: false,
      error: error?.message || 'Worker processing failed'
    };
    self.postMessage(errorResponse);
  }
};
