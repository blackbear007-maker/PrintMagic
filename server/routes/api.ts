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

// Export Industrial PDF/X
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
