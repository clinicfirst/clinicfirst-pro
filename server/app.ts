import express from 'express';
import dotenv from 'dotenv';
import { db } from './db';
import { authRouter } from './routes/auth.routes';
import { platformRouter } from './routes/platform.routes';
import { clinicRouter } from './routes/clinic.routes';
import { aiRouter } from './routes/ai.routes';
import { knowledgeCompilerRouter } from './routes/knowledgeCompiler.routes';
import { voiceRouter } from './routes/voice.routes';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();

// Set trust proxy for environments like Cloud Run, Vercel, or standard reverse proxies
// This ensures req.ip correctly resolves to the client's IP instead of the load balancer's IP
app.set('trust proxy', 1);

const sarvamWebhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per IP per minute
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Protect the Sarvam webhook route specifically before the global body parser
app.use(['/api/voice/webhook/sarvam/*', '/voice/webhook/sarvam/*'], sarvamWebhookLimiter, express.json({ limit: '100kb' }));

// Ensure DB is hydrated from Supabase before processing requests
app.use(async (req, res, next) => {
  try {
    await db.ensureHydrated();
  } catch (err) {
    console.warn('[Server] Supabase auto-hydration error:', err);
  }
  next();
});

// CORS handling
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  
  // Disable browser caching for all API routes to prevent stale data on refresh
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

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



import { supabase } from './supabaseDiff';
import { requireAuth } from './auth';
app.get('/api/diagnostic/verify-supabase', requireAuth, async (req, res) => {
  if (req.user?.role !== 'PLATFORM_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const configured = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  let clientInitialized = false;
  let connectionPass = false;
  if (supabase) {
    clientInitialized = true;
    try {
      const { data, error } = await supabase.from('platform_ai_config').select('id').limit(1);
      if (!error) connectionPass = true;
    } catch(e) {}
  }
  res.json({
    configured: configured ? 'YES' : 'NO',
    clientInitialized: clientInitialized ? 'YES' : 'NO',
    connectionPass: connectionPass ? 'PASS' : 'FAIL'
  });
});

app.use('/api/platform', platformRouter);
app.use('/platform', platformRouter);

app.use('/api/clinic', clinicRouter);
app.use('/clinic', clinicRouter);

app.use('/api/ai', aiRouter);
app.use('/api/compiler', knowledgeCompilerRouter);
app.use('/ai', aiRouter);

app.use('/api/voice', voiceRouter);
app.use('/voice', voiceRouter);

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
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error_code: 'PAYLOAD_TOO_LARGE' });
  }

  console.error('[API Server Error]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'An unexpected server error occurred.' });
  }
});

export { app };
export default app;
