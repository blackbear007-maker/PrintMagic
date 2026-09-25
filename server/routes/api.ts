import express, { Router, type Request, type Response } from 'express';

export const apiRouter = Router();

const VISION_URL = process.env.ZERO_DCE_URL || process.env.AI_ENGINE_URL || 'http://127.0.0.1:8082';
const VTRACER_URL = process.env.VTRACER_URL || 'http://localhost:8080';

// 2026-09-26: /health also says whether the services behind /api/ai/* (zero-dce) and /api/vectorize
// (vtracer) answer. This process serves the site itself, so "Node is up" said nothing about them, and
// every image was uploaded to a dead service first and fell back to the local algorithm only after
// the error. Probes are shared for 30s and give up after 1.5s.
const SERVICE_PROBE_TTL_MS = 30000;
let serviceProbe: { at: number; result: Promise<{ vision: boolean; vectorize: boolean }> } | null = null;

async function probe(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    return (await fetch(`${baseUrl}/health`, { signal: controller.signal })).ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function probeServices(): Promise<{ vision: boolean; vectorize: boolean }> {
  if (!serviceProbe || Date.now() - serviceProbe.at > SERVICE_PROBE_TTL_MS) {
    serviceProbe = {
      at: Date.now(),
      result: Promise.all([probe(VISION_URL), probe(VTRACER_URL)]).then(([vision, vectorize]) => ({ vision, vectorize }))
    };
  }
  return serviceProbe.result;
}

// Health Check
apiRouter.get('/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'PrintMagic Industrial Cloud Engine',
    version: '3.1.0',
    uptimeSeconds: Math.floor(process.uptime()),
    services: await probeServices()
  });
});

// 🌙 Retinexformer Low-Light Enhancement (real trained weights, committed to git, see
// server/services/ai-engine-service.ts for the full honesty note, and for why /ai/matting,
// /ai/segment, and /ai/dewarp were removed rather than kept as no-op stubs)
apiRouter.post('/ai/lowlight', async (req: Request, res: Response) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) {
      res.status(400).json({ success: false, error: 'image_base64 is required' });
      return;
    }
    const { AiEngineService } = await import('../services/ai-engine-service.js');
    const result = await AiEngineService.processLowLight(image_base64);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Low-light enhancement failed' });
  }
});

// 🔍 Real-ESRGAN compact (x4v3) Upscale — real trained weights, see ai-engine-service.ts
apiRouter.post('/ai/upscale', async (req: Request, res: Response) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) {
      res.status(400).json({ success: false, error: 'image_base64 is required' });
      return;
    }
    const { AiEngineService } = await import('../services/ai-engine-service.js');
    const result = await AiEngineService.processUpscale(image_base64);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Upscale failed' });
  }
});

// 🪄 LaMa Object/Watermark Removal — real trained weights, auto-downloaded, see ai-engine-service.ts
apiRouter.post('/ai/inpaint', async (req: Request, res: Response) => {
  try {
    const { image_base64, mask_base64 } = req.body;
    if (!image_base64 || !mask_base64) {
      res.status(400).json({ success: false, error: 'image_base64 and mask_base64 are required' });
      return;
    }
    const { AiEngineService } = await import('../services/ai-engine-service.js');
    const result = await AiEngineService.processInpaint(image_base64, mask_base64);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Inpaint failed' });
  }
});

// ✂️ rembg (u2netp) Background Removal — real trained weights, auto-downloaded, see ai-engine-service.ts
apiRouter.post('/ai/matting', async (req: Request, res: Response) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) {
      res.status(400).json({ success: false, error: 'image_base64 is required' });
      return;
    }
    const { AiEngineService } = await import('../services/ai-engine-service.js');
    const result = await AiEngineService.processMatting(image_base64);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Matting failed' });
  }
});

// 🧑 YuNet Face Detection — real trained weights, auto-downloaded, see ai-engine-service.ts
apiRouter.post('/ai/detect-face', async (req: Request, res: Response) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) {
      res.status(400).json({ success: false, error: 'image_base64 is required' });
      return;
    }
    const { AiEngineService } = await import('../services/ai-engine-service.js');
    const result = await AiEngineService.processDetectFace(image_base64);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Face detection failed' });
  }
});

// 🖨️ Real ICC Soft-Proof + TAC (LittleCMS via Pillow) — requires caller's own CMYK profile, see ai-engine-service.ts
apiRouter.post('/ai/icc-soft-proof', async (req: Request, res: Response) => {
  try {
    const { image_base64, icc_profile_base64 } = req.body;
    if (!image_base64 || !icc_profile_base64) {
      res.status(400).json({ success: false, error: 'image_base64 and icc_profile_base64 are required' });
      return;
    }
    const { AiEngineService } = await import('../services/ai-engine-service.js');
    const result = await AiEngineService.processIccSoftProof(image_base64, icc_profile_base64);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'ICC soft-proof failed' });
  }
});

// 🖨️ Print CMYK separation (Adobe press profile, LittleCMS) — raw PNG in, zlib CMYK samples out.
// Binary both ways: a 300 DPI A3 page as base64 JSON would blow past the global JSON body limit.
apiRouter.post(
  '/ai/cmyk',
  express.raw({ type: 'image/png', limit: process.env.CMYK_BODY_LIMIT || '120mb' }),
  async (req: Request, res: Response) => {
    try {
      const profileId = String(req.query.profile || '');
      if (!Buffer.isBuffer(req.body) || req.body.length === 0 || !profileId) {
        res.status(400).json({ success: false, error: 'POST the PNG bytes (Content-Type: image/png) with ?profile=<id>' });
        return;
      }
      const { AiEngineService } = await import('../services/ai-engine-service.js');
      const result = await AiEngineService.processToCmyk(req.body, profileId);
      if (!result.success) {
        res.status(result.status).json({ success: false, error: result.error });
        return;
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Cmyk-Info', result.info);
      res.send(result.data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'CMYK conversion failed' });
    }
  }
);

// 📐 VTracer Rust Vectorizer Microservice Proxy
apiRouter.post('/vectorize', async (req: Request, res: Response) => {
  try {
    const { imageDataUrl, colors = 12, tolerance = 1.5 } = req.body;
    if (!imageDataUrl) {
      res.status(400).json({ success: false, error: 'imageDataUrl is required' });
      return;
    }

    const vtracerUrl = VTRACER_URL;
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Prepare multipart form data using Blob / FormData
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('image', blob, 'input.png');

    const targetUrl = `${vtracerUrl}/vectorize?colors=${encodeURIComponent(colors)}&tolerance=${encodeURIComponent(tolerance)}`;
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const vtracerRes = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (vtracerRes.ok) {
      const data = await vtracerRes.json();
      res.json({
        success: true,
        svg: data.svg,
        elapsed_ms: data.elapsed_ms,
        engine: 'VTracer Rust 向量核心'
      });
      return;
    }

    res.status(vtracerRes.status).json({
      success: false,
      error: `VTracer returned HTTP ${vtracerRes.status}`
    });
  } catch (err: any) {
    res.status(503).json({
      success: false,
      error: err?.message || 'VTracer service offline / unavailable'
    });
  }
});
