import { DEMOS } from "@codeksnet/shared";

export default function Home() {
  return (
    <main>
      <h1 className="text-3xl font-semibold">Codeks Labs</h1>
      <p className="mt-2 text-neutral-600">
        Small live demos, open source. Each one closes a gap that keeps showing up in real engineering work.
      </p>
      <ul className="mt-8 space-y-4">
        {DEMOS.map((d) => (
          <li key={d.slug} className="rounded border p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-medium">{d.title}</h2>
              <span className="text-xs uppercase text-neutral-500">{d.status}</span>
            </div>
            <p className="mt-1 text-sm text-neutral-600">{d.blurb}</p>
            <div className="mt-2 flex gap-4 text-sm">
              {d.status !== "planned" && <a className="underline" href={d.url}>Live demo</a>}
              <a className="underline" href={d.repo}>Source</a>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
