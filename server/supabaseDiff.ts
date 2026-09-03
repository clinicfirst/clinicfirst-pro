import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

export const isOfflineMode = process.env.OFFLINE_MODE === 'true';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!isOfflineMode) {
  if (!url || !key) {
    throw new Error('CRITICAL ERROR: Supabase credentials (VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are required in production mode. To run in explicit offline development mode, set OFFLINE_MODE=true in your environment.');
  }
}

export const supabase = !isOfflineMode && url && key ? createClient(url, key) : null;
