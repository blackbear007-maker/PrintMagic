/**
 * ImageTool Worker
 * 所有像素級運算都在此執行，避免阻塞主執行緒
 * @version 2.0.0
 */

self.onmessage = function(e) {
  const { id, operation, payload } = e.data;
  try {
    const imageData = payload.imageData;
    const { width, height, data } = imageData;
    let result;

    switch (operation) {
      case 'sharpen':
        result = applySharpenFilter(data, width, height);
        break;
      case 'upscale':
        result = lanczosResize(data, width, height, payload.scale);
        break;
      case 'analyze':
        result = analyzeImage(data, width, height);
        break;
      default:
        throw new Error('Unknown operation: ' + operation);
    }

    if (result instanceof ImageData) {
      self.postMessage({ id, success: true, imageData: { width: result.width, height: result.height, data: result.data } }, [result.data.buffer]);
    } else {
      self.postMessage({ id, success: true, result });
    }
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};


function analyzeImage(data, width, height) {
  const count = width * height;
  let totalLum = 0, totalSat = 0, sumSqLum = 0, edgeSum = 0, transparent = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = (max + min) / 2;
    const sat = max === 0 ? 0 : (max - min) / max;
    totalLum += lum;
    totalSat += sat;
    sumSqLum += lum * lum;
    if (data[i + 3] < 255) transparent++;
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const lum = (Math.max(data[idx], data[idx + 1], data[idx + 2]) + Math.min(data[idx], data[idx + 1], data[idx + 2])) / 2;
      const rightIdx = (y * width + x + 1) * 4;
      const rightLum = (Math.max(data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]) + Math.min(data[rightIdx], data[rightIdx + 1], data[rightIdx + 2])) / 2;
      const downIdx = ((y + 1) * width + x) * 4;
      const downLum = (Math.max(data[downIdx], data[downIdx + 1], data[downIdx + 2]) + Math.min(data[downIdx], data[downIdx + 1], data[downIdx + 2])) / 2;
      edgeSum += Math.abs(lum - rightLum) + Math.abs(lum - downLum);
    }
  }
  const avgLum = totalLum / count;
  const avgSat = totalSat / count;
  const stdLum = Math.sqrt(Math.max(0, sumSqLum / count - avgLum * avgLum));
  const edgeScore = count > 0 ? edgeSum / count : 0;
  return {
    avgLum,
    avgSat,
    stdLum,
    edgeScore,
    transparentRatio: transparent / count,
    width,
    height
  };
}

function applySharpenFilter(data, width, height) {
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const tempData = new Uint8ClampedArray(data);
  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      out[idx + 3] = data[idx + 3];
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        out[idx] = data[idx];
        out[idx + 1] = data[idx + 1];
        out[idx + 2] = data[idx + 2];
        continue;
      }
      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const nIdx = ((y + ky) * width + (x + kx)) * 4;
          const kIdx = (ky + 1) * 3 + (kx + 1);
          r += tempData[nIdx] * kernel[kIdx];
          g += tempData[nIdx + 1] * kernel[kIdx];
          b += tempData[nIdx + 2] * kernel[kIdx];
        }
      }
      out[idx] = Math.min(255, Math.max(0, r));
      out[idx + 1] = Math.min(255, Math.max(0, g));
      out[idx + 2] = Math.min(255, Math.max(0, b));
    }
  }

  return new ImageData(out, width, height);
}

function lanczosResize(data, srcWidth, srcHeight, scale) {
  const dstWidth = Math.round(srcWidth * scale);
  const dstHeight = Math.round(srcHeight * scale);
  const a = 3;
  const tmp = new Uint8ClampedArray(dstWidth * srcHeight * 4);
  const out = new Uint8ClampedArray(dstWidth * dstHeight * 4);

  // horizontal pass
  for (let y = 0; y < srcHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const center = (x + 0.5) / scale - 0.5;
      const x0 = Math.ceil(center - a);
      const x1 = Math.floor(center + a);
      let totalWeight = 0;
      let r = 0, g = 0, b = 0, alpha = 0;
      for (let sx = x0; sx <= x1; sx++) {
        const w = lanczosKernel(center - sx, a);
        if (w === 0) continue;
        const clampedX = Math.max(0, Math.min(srcWidth - 1, sx));
        const idx = (y * srcWidth + clampedX) * 4;
        r += data[idx] * w;
        g += data[idx + 1] * w;
        b += data[idx + 2] * w;
        alpha += data[idx + 3] * w;
        totalWeight += w;
      }
      const dstIdx = (y * dstWidth + x) * 4;
      const norm = totalWeight || 1;
      tmp[dstIdx] = Math.min(255, Math.max(0, Math.round(r / norm)));
      tmp[dstIdx + 1] = Math.min(255, Math.max(0, Math.round(g / norm)));
      tmp[dstIdx + 2] = Math.min(255, Math.max(0, Math.round(b / norm)));
      tmp[dstIdx + 3] = Math.min(255, Math.max(0, Math.round(alpha / norm)));
    }
  }

  // vertical pass
  for (let y = 0; y < dstHeight; y++) {
    const center = (y + 0.5) / scale - 0.5;
    const y0 = Math.ceil(center - a);
    const y1 = Math.floor(center + a);
    for (let x = 0; x < dstWidth; x++) {
      let totalWeight = 0;
      let r = 0, g = 0, b = 0, alpha = 0;
      for (let sy = y0; sy <= y1; sy++) {
        const w = lanczosKernel(center - sy, a);
        if (w === 0) continue;
        const clampedY = Math.max(0, Math.min(srcHeight - 1, sy));
        const idx = (clampedY * dstWidth + x) * 4;
        r += tmp[idx] * w;
        g += tmp[idx + 1] * w;
        b += tmp[idx + 2] * w;
        alpha += tmp[idx + 3] * w;
        totalWeight += w;
      }
      const dstIdx = (y * dstWidth + x) * 4;
      const norm = totalWeight || 1;
      out[dstIdx] = Math.min(255, Math.max(0, Math.round(r / norm)));
      out[dstIdx + 1] = Math.min(255, Math.max(0, Math.round(g / norm)));
      out[dstIdx + 2] = Math.min(255, Math.max(0, Math.round(b / norm)));
      out[dstIdx + 3] = Math.min(255, Math.max(0, Math.round(alpha / norm)));
    }
  }

  return new ImageData(out, dstWidth, dstHeight);
}

function lanczosKernel(x, a) {
  if (x === 0) return 1;
  if (Math.abs(x) >= a) return 0;
  const piX = Math.PI * x;
  return (a * Math.sin(piX) * Math.sin(piX / a)) / (piX * piX);
}

