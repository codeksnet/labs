import { getSupabase } from "@codeksnet/shared";

export const dynamic = "force-dynamic";

/** Corrections as a codeks-evals JSONL eval set. Run with:
 *  codeks-evals run data-regressions.jsonl --target labs_scraper.eval_target:parse_json */
export async function GET() {
  const db = getSupabase("data");
  if (!db) return new Response("not configured", { status: 503 });
  const { data, error } = await db.from("regression_cases").select("case_id, entity_id, input, expected").order("id");
  if (error) return new Response(error.message, { status: 500 });
  const lines = (data ?? []).map((c: { case_id: string; entity_id: number; input: string; expected: string }) =>
    JSON.stringify({ id: c.case_id, input: c.input, expected: c.expected, scorer: "exact", meta: { entity_id: c.entity_id } }));
  return new Response(lines.join("\n") + (lines.length ? "\n" : ""), {
    headers: { "content-type": "application/x-ndjson", "content-disposition": 'attachment; filename="data-regressions.jsonl"' },
  });
}
