import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Eigene Supabase-Instanz, bewusst getrennt von der von Scooly.
 * Wenn Scoolys Datenbank ausfällt, muss diese Seite trotzdem stehen.
 */
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  if (!cached) {
    cached = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export function hasDatabase(): boolean {
  return Boolean(url && serviceKey);
}
