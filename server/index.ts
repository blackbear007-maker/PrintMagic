import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/api.js';

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

// Start Server
app.listen(PORT, () => {
  console.log(`✨ PrintMagic Industrial Backend Engine running on http://localhost:${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   ICC Profiles: http://localhost:${PORT}/api/icc-profiles`);
});
