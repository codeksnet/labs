import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@codeksnet/shared";

export const dynamic = "force-dynamic";

type Case = { id: number; case_id: string; passed: boolean; output: string | null; detail: string | null; latency_s: number | null };

export default async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getSupabase("evals");
  if (!db) notFound();
  const [{ data: run }, { data: cases }] = await Promise.all([
    db.from("runs").select("*").eq("id", id).single(),
    db.from("run_cases").select("*").eq("run_id", id).order("passed").order("case_id"),
  ]);
  if (!run) notFound();

  return (
    <main>
      <Link className="text-sm underline" href="/">← All runs</Link>
      <h1 className="mt-2 text-2xl font-semibold">{run.name}</h1>
      <p className="text-sm text-neutral-600">
        {run.passed}/{run.total} passed · {run.avg_latency_s.toFixed(2)}s avg
        {run.trace_url && <> · <a className="underline" href={run.trace_url}>Langfuse trace</a></>}
      </p>
      <ul className="mt-6 space-y-2">
        {((cases ?? []) as Case[]).map((c) => (
          <li key={c.id} className={`rounded border p-3 text-sm ${c.passed ? "" : "border-red-300 bg-red-50"}`}>
            <div className="font-mono">{c.passed ? "PASS" : "FAIL"} {c.case_id}</div>
            {c.detail && <div className="mt-1 text-neutral-700">{c.detail}</div>}
            {c.output && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-neutral-500">{c.output}</pre>}
          </li>
        ))}
      </ul>
    </main>
  );
}
