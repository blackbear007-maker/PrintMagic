import { Router, type Request, type Response } from 'express';
import { IccService } from '../services/icc-service.js';
import { PdfxService } from '../services/pdfx-service.js';

export const apiRouter = Router();

// Health Check
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'PrintMagic Industrial Cloud Engine',
    version: '3.1.0',
    uptimeSeconds: Math.floor(process.uptime()),
    features: ['pdfx-1a', 'pdfx-4', 'icc-profiles', 'tac-validator']
  });
});

// List ICC Profiles
apiRouter.get('/icc-profiles', (_req: Request, res: Response) => {
  const profiles = IccService.listProfiles();
  res.json({
    success: true,
    profiles
  });
});

// Pre-flight validation
apiRouter.post('/preflight', (req: Request, res: Response) => {
  const { maxTac = 300, profileId = 'japan-color-2001' } = req.body;
  const result = IccService.validateTacCompliance(maxTac, profileId);
  res.json({
    success: true,
    result
  });
});

// Export server-side pre-press PDF (RGB content; not a validated PDF/X file — see pdfx-service.ts)
apiRouter.post('/export-pdfx', async (req: Request, res: Response) => {
  try {
    const { imageDataUrl, preset, iccProfileId, pdfStandard, artworkName } = req.body;

    if (!imageDataUrl || !preset) {
      res.status(400).json({ success: false, error: 'imageDataUrl and preset are required' });
      return;
    }

    const { buffer, checksum, fileName, standard, iccName } = await PdfxService.generatePdfx({
      imageDataUrl,
      preset,
      iccProfileId,
      pdfStandard,
      artworkName
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('X-PrintMagic-Checksum', checksum);
    res.setHeader('X-PrintMagic-Standard', standard);
    res.setHeader('X-PrintMagic-ICC', encodeURIComponent(iccName));

    res.send(buffer);
  } catch (err: any) {
    console.error('PDF/X export error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate PDF/X' });
  }
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

// 📊 ARNIQA No-Reference Quality Score — real trained weights, see ai-engine-service.ts
apiRouter.post('/ai/quality', async (req: Request, res: Response) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) {
      res.status(400).json({ success: false, error: 'image_base64 is required' });
      return;
    }
    const { AiEngineService } = await import('../services/ai-engine-service.js');
    const result = await AiEngineService.processQuality(image_base64);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Quality assessment failed' });
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

// 📐 VTracer Rust Vectorizer Microservice Proxy
apiRouter.post('/vectorize', async (req: Request, res: Response) => {
  try {
    const { imageDataUrl, colors = 12, tolerance = 1.5 } = req.body;
    if (!imageDataUrl) {
      res.status(400).json({ success: false, error: 'imageDataUrl is required' });
      return;
    }

    const vtracerUrl = process.env.VTRACER_URL || 'http://localhost:8080';
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

// 🏁 K100 Pure Black Vector Barcode / QR Generator Endpoint — ⚠️ not actually scannable, see
// the honesty note in src/core/k100-barcode-generator.ts. Not called by any UI in this app.
apiRouter.post('/prepress/k100-barcode', async (req: Request, res: Response) => {
  try {
    const { text, type = 'qr' } = req.body;
    if (!text) {
      res.status(400).json({ success: false, error: 'text is required' });
      return;
    }
    const { PrepressToolkitService } = await import('../services/prepress-toolkit.js');
    const svg = PrepressToolkitService.generateBarcode(text, type);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.send(svg);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Barcode generation failed' });
  }
});

// ⚡ SVGO Vector Path & Dieline Optimizer Endpoint
apiRouter.post('/prepress/optimize-svg', async (req: Request, res: Response) => {
  try {
    const { svg, precision = 1 } = req.body;
    if (!svg) {
      res.status(400).json({ success: false, error: 'svg content is required' });
      return;
    }
    const { PrepressToolkitService } = await import('../services/prepress-toolkit.js');
    const result = PrepressToolkitService.optimizeSvg(svg, precision);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'SVG optimization failed' });
  }
});

// 📐 Gang-Run Imposition Layout Calculator Endpoint
apiRouter.post('/prepress/imposition', async (req: Request, res: Response) => {
  try {
    const { itemWidthMm, itemHeightMm, sheetId = 'A3', cuttingGapMm = 3 } = req.body;
    if (!itemWidthMm || !itemHeightMm) {
      res.status(400).json({ success: false, error: 'itemWidthMm and itemHeightMm are required' });
      return;
    }
    const { PrepressToolkitService } = await import('../services/prepress-toolkit.js');
    const result = PrepressToolkitService.calculateImposition(Number(itemWidthMm), Number(itemHeightMm), sheetId, Number(cuttingGapMm));
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Imposition calculation failed' });
  }
});

// 🌈 Pantone Spot Color Matcher Endpoint
apiRouter.post('/prepress/pantone-match', async (req: Request, res: Response) => {
  try {
    const { r, g, b } = req.body;
    if (r === undefined || g === undefined || b === undefined) {
      res.status(400).json({ success: false, error: 'r, g, b are required' });
      return;
    }
    const { PrepressToolkitService } = await import('../services/prepress-toolkit.js');
    const match = PrepressToolkitService.matchPantone(Number(r), Number(g), Number(b));
    res.json({ success: true, match });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Pantone match failed' });
  }
});




