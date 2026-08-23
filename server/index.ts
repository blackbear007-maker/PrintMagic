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
app.use(cors({
  origin: '*',
  exposedHeaders: ['X-PrintMagic-Checksum', 'X-PrintMagic-Standard', 'X-PrintMagic-ICC', 'Content-Disposition']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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

