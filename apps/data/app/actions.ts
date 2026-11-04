"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@codeksnet/shared";
import { canonical, type Fields } from "@/lib/canonical";

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));

/**
 * Fix a row. This (1) records the human value, (2) stops later scrapes overwriting it,
 * and (3) turns the fix into an eval regression case: the page HTML in, the corrected fields out.
 */
export async function correct(formData: FormData) {
  const db = getSupabase("data");
  if (!db) throw new Error("Supabase is not configured");
  const id = Number(formData.get("id"));

  const { data: before, error } = await db.from("entities").select("*").eq("id", id).single();
  if (error || !before) throw new Error(`entity ${id} not found`);

  const after: Fields = {
    title: String(formData.get("title") ?? "").trim() || null,
    price: num(formData.get("price")),
    currency: String(formData.get("currency") ?? "").trim() || null,
    rating: num(formData.get("rating")),
    in_stock: num(formData.get("in_stock")),
  };
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const k of Object.keys(after) as (keyof Fields)[]) {
    const o = k === "price" && before[k] !== null ? Number(before[k]) : before[k];
    if (o !== after[k]) changes[k] = { old: before[k], new: after[k] };
  }

  const { data: snap } = await db.from("raw_snapshots").select("id, html")
    .eq("url", before.url).order("fetched_at", { ascending: false }).limit(1).maybeSingle();

  if (snap && Object.keys(changes).length > 0) {
    // Case first: if this insert fails nothing has been changed yet.
    const { error: e1 } = await db.from("regression_cases").insert({
      entity_id: id, case_id: `data-${id}-${Date.now()}`, input: snap.html, expected: canonical(after),
    });
    if (e1) throw new Error(e1.message);
  }
  const { error: e2 } = await db.from("entities").update({
    ...after, corrected: true, needs_review: false, confidence: 1, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (e2) throw new Error(e2.message);
  if (Object.keys(changes).length > 0) {
    await db.from("entity_history").insert({ entity_id: id, reason: "correction", changes, snapshot_id: snap?.id ?? null });
  }
  revalidatePath("/");
}
