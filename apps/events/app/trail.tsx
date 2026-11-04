"use client";

import { useEffect, useState } from "react";
import type { TrailItem } from "@/lib/contract";

export function Trail({ id }: { id: string }) {
  const [items, setItems] = useState<TrailItem[]>([]);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const res = await fetch(`/api/trail?r=${id}`);
      if (res.ok && !stop) setItems(await res.json());
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(t); };
  }, [id]);

  return (
    <ul className="mt-4 space-y-2">
      {items.length === 0 && <li className="text-sm text-neutral-500">Waiting for workers…</li>}
      {items.map((i) => (
        <li key={i.sk} className={`rounded border p-3 text-sm ${i.status === "failed" ? "border-red-300 bg-red-50" : ""}`}>
          <span className="font-mono">{i.status === "ok" ? "OK  " : "FAIL"} {i.stage}</span>
          <div className="mt-1 text-neutral-700">{i.message}</div>
        </li>
      ))}
    </ul>
  );
}
