/** Keyless demo embedding: hashed bag-of-words into 64 dims, L2-normalised. Swap for a real model. */
export const DIM = 64;

export function embed(text: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 2166136261;
    for (const ch of word) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    v[(h >>> 0) % DIM] += 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

export const toPgVector = (v: number[]) => `[${v.join(",")}]`;
