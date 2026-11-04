import { cookies } from "next/headers";
import { clientFor, isTenantKey, TENANTS, type TenantKey } from "@/lib/db";
import { embed, toPgVector } from "@/lib/embed";
import { switchTenant } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const c = (await cookies()).get("tenant")?.value;
  const tenant: TenantKey = isTenantKey(c) ? c : "acme";
  const db = await clientFor(tenant);

  let visible: { tenants: string[]; documents: number; chunks: number } | null = null;
  let hits: { id: number; content: string; similarity: number }[] = [];
  if (db) {
    const [t, d, ch] = await Promise.all([
      db.from("tenants").select("name"),
      db.from("documents").select("id", { count: "exact", head: true }),
      db.from("chunks").select("id", { count: "exact", head: true }),
    ]);
    visible = { tenants: (t.data ?? []).map((r: { name: string }) => r.name), documents: d.count ?? 0, chunks: ch.count ?? 0 };
    if (q) hits = (await db.rpc("match_chunks", { query_embedding: toPgVector(embed(q)), match_count: 3 })).data ?? [];
  }

  return (
    <main>
      <h1 className="text-2xl font-semibold">Tenant isolation</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Two fake tenants share one database. Row-level security, not the app, decides what each can read.
        The <a className="underline" href="https://github.com/codeksnet/labs/tree/main/apps/tenants/tests">leak test</a> runs on every PR.
      </p>

      <form action={switchTenant} className="mt-6 flex gap-2">
        {(Object.keys(TENANTS) as TenantKey[]).map((k) => (
          <button key={k} name="tenant" value={k}
            className={`rounded border px-3 py-1 text-sm ${k === tenant ? "bg-neutral-900 text-white" : ""}`}>
            {TENANTS[k].label}
          </button>
        ))}
      </form>

      {!db ? (
        <p className="mt-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Supabase is not configured (see .env.example and apps/tenants/README.md).
        </p>
      ) : (
        <>
          <section className="mt-6 rounded border p-4 text-sm">
            <h2 className="font-medium">What this session can see (plain <code>select</code>, no filters)</h2>
            <p className="mt-1">Tenants: {visible!.tenants.join(", ") || "none"} · documents: {visible!.documents} · chunks: {visible!.chunks}</p>
          </section>

          <form className="mt-6 flex gap-2">
            <input name="q" defaultValue={q} placeholder="Ask the knowledge base…" className="flex-1 rounded border px-3 py-1 text-sm" />
            <button className="rounded border px-3 py-1 text-sm">Search</button>
          </form>
          <ul className="mt-4 space-y-2">
            {hits.map((h) => (
              <li key={h.id} className="rounded border p-3 text-sm">
                {h.content}
                <span className="ml-2 text-xs text-neutral-500">{h.similarity.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          {q && hits.length === 0 && <p className="mt-4 text-sm text-neutral-500">No results.</p>}
        </>
      )}
    </main>
  );
}
