import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
// CORS: allowlist from ALLOWED_ORIGINS (comma-separated). Unset: localhost dev origins outside
// production (cloud-client.ts calls :3001 from the Vite dev server), same-origin only in production.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0
    ? allowedOrigins
    : process.env.NODE_ENV === 'production' ? false : /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  exposedHeaders: ['X-PrintMagic-Checksum', 'X-PrintMagic-Standard', 'X-PrintMagic-ICC', 'Content-Disposition']
}));

// Body limit: the AI services cap images at 10MB (~14MB base64); print exports can be larger, so
// keep headroom but far below the old 100MB. Override with BODY_LIMIT if needed.
const BODY_LIMIT = process.env.BODY_LIMIT || '40mb';
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// API Routes
app.use('/api', apiRouter);

// Serve static frontend in production
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('PrintMagic Backend Running. Run `npm run build` to serve frontend.');
    }
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`✨ PrintMagic Industrial Backend Engine running on http://localhost:${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   ICC Profiles: http://localhost:${PORT}/api/icc-profiles`);
});

