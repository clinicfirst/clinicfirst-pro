import express from 'express';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.routes';
import { platformRouter } from './routes/platform.routes';
import { clinicRouter } from './routes/clinic.routes';
import { aiRouter } from './routes/ai.routes';

dotenv.config();

const app = express();

// CORS handling
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serverless / Vercel URL normalization middleware
app.use((req, res, next) => {
  // If Vercel rewrote /api/... to /api or /api/index.js
  const forwardedPath =
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-forwarded-uri'] as string) ||
    (req.headers['x-invoke-path'] as string) ||
    req.originalUrl;

  if (
    forwardedPath &&
    typeof forwardedPath === 'string' &&
    forwardedPath.startsWith('/api') &&
    (req.url === '/' ||
      req.url === '/api' ||
      req.url === '/api/' ||
      req.url === '/api/index' ||
      req.url === '/api/index.js' ||
      req.url.includes('[...all]') ||
      req.url.includes('[...path]'))
  ) {
    req.url = forwardedPath;
  }
  next();
});

// Helper to ensure req.body is an object
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      // ignore
    }
  }
  next();
});

// API Routes mounted both with /api prefix and without to guarantee Vercel Serverless Function path compatibility
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

app.use('/api/platform', platformRouter);
app.use('/platform', platformRouter);

app.use('/api/clinic', clinicRouter);
app.use('/clinic', clinicRouter);

app.use('/api/ai', aiRouter);
app.use('/ai', aiRouter);

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'CLINICFIRST API',
    timestamp: new Date().toISOString(),
  });
});

// Catch-all 404 ONLY for unmatched /api routes (allows frontend & Vite middleware to pass through)
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}`,
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Server Error]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'An unexpected server error occurred.' });
  }
});

export { app };
export default app;
