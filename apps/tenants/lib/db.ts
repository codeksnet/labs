import { createClient } from "@supabase/supabase-js";

export const TENANTS = {
  acme: { label: "Acme Cleaning Co.", email: "alice@acme.test" },
  globex: { label: "Globex Property Mgmt", email: "bob@globex.test" },
} as const;
export type TenantKey = keyof typeof TENANTS;

export function isTenantKey(v: string | undefined): v is TenantKey {
  return v === "acme" || v === "globex";
}

/** A client signed in as the demo user of one tenant. Every query goes through RLS as that user. */
export async function clientFor(tenant: TenantKey) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const password = process.env.DEMO_PASSWORD;
  if (!url || !anon || !password) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient<any, string>(url, anon, { db: { schema: "tenants" }, auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email: TENANTS[tenant].email, password });
  if (error) throw new Error(`demo sign-in failed: ${error.message}`);
  return db;
}
