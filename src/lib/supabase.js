// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · Client Supabase
//  Chiave "publishable": fatta per il browser. La sicurezza dei
//  dati dipende dalle policy RLS (supabase/migrations/002_rls.sql),
//  non da questa chiave.
// ══════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY mancanti in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Helper ristorante dell'utente loggato ──────────────────────
// Ritorna la riga `restaurants` dell'account corrente (o null).
export async function getMyRestaurant() {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
