// Idempotent seed. Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, DEMO_PASSWORD (fake users).
import { createClient } from "@supabase/supabase-js";
import { embed, toPgVector } from "../lib/embed";
import { SEED } from "../seed/data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const password = process.env.DEMO_PASSWORD!;
if (!url || !key || !password) throw new Error("set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, DEMO_PASSWORD");

const admin = createClient(url, key, { auth: { persistSession: false } });
const db = admin.schema("tenants");

async function userId(email: string): Promise<string> {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const found = data.users.find((u) => u.email === email);
  if (!found) throw new Error(`cannot create or find ${email}: ${created.error?.message}`);
  await admin.auth.admin.updateUserById(found.id, { password });
  return found.id;
}

for (const [slug, t] of Object.entries(SEED)) {
  const { data: tenant, error } = await db.from("tenants").upsert({ slug, name: t.name }, { onConflict: "slug" }).select().single();
  if (error) throw error;
  await db.from("memberships").upsert({ user_id: await userId(t.email), tenant_id: tenant.id });
  await db.from("documents").delete().eq("tenant_id", tenant.id); // cascades to chunks
  for (const d of t.docs) {
    const { data: doc, error: e1 } = await db.from("documents").insert({ tenant_id: tenant.id, title: d.title }).select().single();
    if (e1) throw e1;
    const { error: e2 } = await db.from("chunks").insert({
      tenant_id: tenant.id, document_id: doc.id, content: d.content, embedding: toPgVector(embed(d.content)),
    });
    if (e2) throw e2;
  }
  console.log(`seeded ${slug}`);
}
