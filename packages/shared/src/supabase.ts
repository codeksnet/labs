import { createClient } from "@supabase/supabase-js";

/** Server-side client scoped to one schema (one schema per app). Returns null when unconfigured. */
export function getSupabase(schema: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<any, string>(url, key, { db: { schema }, auth: { persistSession: false } }); // eslint-disable-line @typescript-eslint/no-explicit-any
}
