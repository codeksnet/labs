// Crude in-memory cap on emitted events per hour (per server process). Keeps a public demo cheap.
const MAX_PER_HOUR = 60;
let windowStart = Date.now();
let count = 0;

export function allow(): boolean {
  if (Date.now() - windowStart > 3600_000) { windowStart = Date.now(); count = 0; }
  return ++count <= MAX_PER_HOUR;
}
