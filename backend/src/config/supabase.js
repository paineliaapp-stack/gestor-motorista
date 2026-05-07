import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[Supabase] Variáveis de ambiente não configuradas');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  fetch: (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))
});
