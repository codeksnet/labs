import { configured } from "@/lib/aws";
import { createReservation } from "./actions";
import { Trail } from "./trail";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "not-configured": "AWS is not configured for this deployment (see apps/events/README.md).",
  "rate-limited": "Demo rate limit reached. Try again later.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ r?: string; error?: string }> }) {
  const { r, error } = await searchParams;
  return (
    <main>
      <h1 className="text-2xl font-semibold">Events on AWS</h1>
      <p className="mt-1 text-sm text-neutral-600">
        One <code>reservation.created</code> event fans out through EventBridge to three SQS queues and Lambda workers:
        schedule cleaning, send confirmation, generate the owner statement. Tick the box to break the statement worker and watch it retry, then land in the DLQ.
      </p>
      {error && <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">{ERRORS[error] ?? error}</p>}
      {!configured() && !error && <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">{ERRORS["not-configured"]}</p>}

      <form action={createReservation} className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <input name="guest" placeholder="Guest name" className="rounded border px-3 py-1" />
        <input name="nights" type="number" min={1} max={30} defaultValue={3} className="w-20 rounded border px-3 py-1" />
        <label className="flex items-center gap-1"><input name="fail" type="checkbox" /> simulate failure</label>
        <button className="rounded border bg-neutral-900 px-3 py-1 text-white">Create reservation</button>
      </form>

      {r && (
        <section className="mt-8">
          <h2 className="font-medium">Event trail</h2>
          <p className="font-mono text-xs text-neutral-500">{r}</p>
          <Trail id={r} />
        </section>
      )}
    </main>
  );
}
