import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const isVercel = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const isProdEnv = process.env.NODE_ENV === 'production';

// Strict runtime mode determination:
// Offline development mode is permitted ONLY when explicitly enabled via OFFLINE_MODE='true'
// in a non-production, non-Vercel environment.
// Production, Vercel deployments, or missing-credentials testing without explicit OFFLINE_MODE
// MUST FAIL CLOSED.
export const isOfflineMode = !isVercel && !isProdEnv && process.env.OFFLINE_MODE === 'true';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!isOfflineMode) {
  if (!url || !key) {
    throw new Error('CRITICAL ERROR: Supabase credentials (VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are required in production mode. Missing credentials fail closed. To run in explicit offline development mode, set OFFLINE_MODE=true in a non-production environment.');
  }
} else {
  console.log('ℹ️ Running in explicit OFFLINE_MODE (development runtime). Database persistence is local/in-memory.');
}

export const supabase = !isOfflineMode && url && key ? createClient(url, key) : null;
