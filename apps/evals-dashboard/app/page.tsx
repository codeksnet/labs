import Link from "next/link";
import { getSupabase } from "@codeksnet/shared";

export const dynamic = "force-dynamic";

type Run = {
  id: string; created_at: string; name: string; git_sha: string | null;
  total: number; passed: number; pass_rate: number; avg_latency_s: number; trace_url: string | null;
};

export default async function Runs() {
  const db = getSupabase("evals");
  const { data, error } = db
    ? await db.from("runs").select("*").order("created_at", { ascending: false }).limit(50)
    : { data: null, error: { message: "Supabase is not configured (see .env.example)." } };
  const runs = (data ?? []) as Run[];

  return (
    <main>
      <h1 className="text-2xl font-semibold">Eval runs</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Produced by <a className="underline" href="https://github.com/codeksnet/evals">codeks-evals</a>.
      </p>
      {error && <p className="mt-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm">{error.message}</p>}
      {!error && runs.length === 0 && <p className="mt-6 text-sm text-neutral-500">No runs yet.</p>}
      {runs.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b text-neutral-500">
            <tr><th className="py-2">When</th><th>Set</th><th>Pass rate</th><th>Latency</th><th>Commit</th></tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2"><Link className="underline" href={`/runs/${r.id}`}>{new Date(r.created_at).toLocaleString()}</Link></td>
                <td>{r.name}</td>
                <td>{r.passed}/{r.total} ({Math.round(r.pass_rate * 100)}%)</td>
                <td>{r.avg_latency_s.toFixed(2)}s</td>
                <td className="font-mono">{r.git_sha?.slice(0, 7) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
