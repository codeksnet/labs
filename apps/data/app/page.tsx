import { getSupabase } from "@codeksnet/shared";
import { correct } from "./actions";

export const dynamic = "force-dynamic";

type Entity = {
  id: number; title: string | null; price: number | null; currency: string | null; rating: number | null;
  in_stock: number | null; confidence: number; confidence_reasons: string[]; url: string;
};

export default async function Queue() {
  const db = getSupabase("data");
  if (!db) return <Notice>Supabase is not configured (see .env.example and apps/data/README.md).</Notice>;
  const [queue, total, cases] = await Promise.all([
    db.from("entities").select("*").eq("needs_review", true).order("confidence").limit(25),
    db.from("entities").select("id", { count: "exact", head: true }),
    db.from("regression_cases").select("id", { count: "exact", head: true }),
  ]);
  if (queue.error) return <Notice>{queue.error.message}</Notice>;
  const rows = (queue.data ?? []) as Entity[];
  const metabase = process.env.NEXT_PUBLIC_METABASE_URL;

  return (
    <main>
      <h1 className="text-2xl font-semibold">Review queue</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {total.count ?? 0} entities scraped, {rows.length} below the confidence threshold. Fixing a row also creates an
        eval regression case ({cases.count ?? 0} so far, <a className="underline" href="/api/regressions">download JSONL</a>).
        {metabase && <> <a className="underline" href={metabase}>Dashboards</a>.</>}
      </p>
      {rows.length === 0 && <p className="mt-6 text-sm text-neutral-500">Nothing to review.</p>}
      <ul className="mt-6 space-y-4">
        {rows.map((e) => (
          <li key={e.id} className="rounded border p-4 text-sm">
            <div className="flex items-baseline justify-between">
              <a className="underline" href={e.url}>{e.title ?? "(no title)"}</a>
              <span className="font-mono">{e.confidence.toFixed(2)} · {e.confidence_reasons.join(", ")}</span>
            </div>
            <form action={correct} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
              <input type="hidden" name="id" value={e.id} />
              <input name="title" defaultValue={e.title ?? ""} placeholder="title" className="col-span-2 rounded border px-2 py-1 sm:col-span-2" />
              <input name="price" defaultValue={e.price ?? ""} placeholder="price" inputMode="decimal" className="rounded border px-2 py-1" />
              <input name="currency" defaultValue={e.currency ?? ""} placeholder="GBP" className="rounded border px-2 py-1" />
              <input name="rating" defaultValue={e.rating ?? ""} placeholder="1-5" inputMode="numeric" className="rounded border px-2 py-1" />
              <input name="in_stock" defaultValue={e.in_stock ?? ""} placeholder="stock" inputMode="numeric" className="rounded border px-2 py-1" />
              <button className="col-span-2 rounded border bg-neutral-900 px-3 py-1 text-white sm:col-span-6">Save correction</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{children}</p>;
}
