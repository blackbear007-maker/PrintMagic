import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRecognize = vi.fn();
const mockTerminate = vi.fn();
const mockCreateWorker = vi.fn();

vi.mock('tesseract.js', () => ({
  createWorker: (...args: any[]) => mockCreateWorker(...args),
  OEM: { LSTM_ONLY: 1 }
}));

import { FreeOcrClient, OCR_MIN_TRUSTED_CONFIDENCE } from '../src/services/free-ocr-client';

describe('FreeOcrClient (self-hosted Tesseract.js wrapper)', () => {
  beforeEach(() => {
    mockRecognize.mockReset();
    mockTerminate.mockReset();
    mockCreateWorker.mockReset();
    // Force a fresh worker on every test — FreeOcrClient caches its worker promise as a static,
    // so without this, state would leak across tests in this file.
    // @ts-ignore — reaching into the private static for test isolation only
    FreeOcrClient.workerPromise = null;

    mockCreateWorker.mockResolvedValue({
      recognize: mockRecognize,
      terminate: mockTerminate
    });
  });

  it('exposes a confidence threshold used to gate trust in recognized text', () => {
    expect(typeof OCR_MIN_TRUSTED_CONFIDENCE).toBe('number');
    expect(OCR_MIN_TRUSTED_CONFIDENCE).toBeGreaterThan(0);
    expect(OCR_MIN_TRUSTED_CONFIDENCE).toBeLessThanOrEqual(100);
  });

  it('recognizeRegion returns trimmed text and confidence from a successful recognition', async () => {
    mockRecognize.mockResolvedValue({ data: { text: '  HELLO WORLD  \n', confidence: 87.5 } });

    const canvas = FreeOcrClient.imageDataToCanvas({
      width: 10, height: 10, data: new Uint8ClampedArray(400), colorSpace: 'srgb'
    } as ImageData)!;
    const result = await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 10, height: 10 });

    expect(result).toEqual({ text: 'HELLO WORLD', confidence: 87.5 });
  });

  it('strips Tesseract\'s per-character spacing artifact from CJK text without touching Latin spacing', async () => {
    const canvas = {} as any;

    mockRecognize.mockResolvedValueOnce({ data: { text: '限量 特 別 版', confidence: 93 } });
    const chinese = await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });
    expect(chinese?.text).toBe('限量特別版');

    mockRecognize.mockResolvedValueOnce({ data: { text: 'SALE 特別版', confidence: 90 } });
    const mixed = await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });
    expect(mixed?.text).toBe('SALE 特別版');

    mockRecognize.mockResolvedValueOnce({ data: { text: 'GRAND OPENING', confidence: 95 } });
    const latin = await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });
    expect(latin?.text).toBe('GRAND OPENING');
  });

  it('passes the region as a rectangle option rather than pre-cropping the canvas', async () => {
    mockRecognize.mockResolvedValue({ data: { text: 'X', confidence: 99 } });
    const canvas = {} as any;
    const region = { x: 12, y: 34, width: 56, height: 78 };

    await FreeOcrClient.recognizeRegion(canvas, region);

    expect(mockRecognize).toHaveBeenCalledWith(
      canvas,
      { rectangle: { left: 12, top: 34, width: 56, height: 78 } }
    );
  });

  it('reuses a single worker instance across multiple recognizeRegion calls', async () => {
    mockRecognize.mockResolvedValue({ data: { text: 'A', confidence: 80 } });
    const canvas = {} as any;

    await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });
    await FreeOcrClient.recognizeRegion(canvas, { x: 1, y: 1, width: 1, height: 1 });
    await FreeOcrClient.recognizeRegion(canvas, { x: 2, y: 2, width: 1, height: 1 });

    expect(mockCreateWorker).toHaveBeenCalledTimes(1);
    expect(mockRecognize).toHaveBeenCalledTimes(3);
  });

  it('returns null (not a throw) when the worker fails to initialize', async () => {
    mockCreateWorker.mockRejectedValue(new Error('self-hosted assets missing'));
    const canvas = {} as any;

    const result = await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });

    expect(result).toBeNull();
  });

  it('retries worker creation on the next call after a prior initialization failure', async () => {
    mockCreateWorker.mockRejectedValueOnce(new Error('transient failure'));
    const canvas = {} as any;

    const first = await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });
    expect(first).toBeNull();

    mockRecognize.mockResolvedValue({ data: { text: 'RECOVERED', confidence: 90 } });
    const second = await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });

    expect(second).toEqual({ text: 'RECOVERED', confidence: 90 });
    expect(mockCreateWorker).toHaveBeenCalledTimes(2);
  });

  it('returns null (not a throw) when recognize() itself rejects', async () => {
    mockRecognize.mockRejectedValue(new Error('recognition failed'));
    const canvas = {} as any;

    const result = await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });

    expect(result).toBeNull();
  });

  it('imageDataToCanvas returns a canvas-like object with the correct dimensions', () => {
    const canvas = FreeOcrClient.imageDataToCanvas({
      width: 123, height: 45, data: new Uint8ClampedArray(123 * 45 * 4), colorSpace: 'srgb'
    } as ImageData);

    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBe(123);
    expect(canvas!.height).toBe(45);
  });

  it('terminate() releases the worker and a subsequent call creates a fresh one', async () => {
    mockRecognize.mockResolvedValue({ data: { text: 'X', confidence: 80 } });
    const canvas = {} as any;

    await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });
    await FreeOcrClient.terminate();
    expect(mockTerminate).toHaveBeenCalledTimes(1);

    await FreeOcrClient.recognizeRegion(canvas, { x: 0, y: 0, width: 1, height: 1 });
    expect(mockCreateWorker).toHaveBeenCalledTimes(2);
  });
});
