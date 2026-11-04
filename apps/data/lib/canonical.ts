/** Mirror of scraper/src/labs_scraper/eval_target.py `canonical`. Keys sorted, compact, price as a 2-decimal string. */
export type Fields = {
  title: string | null; price: number | string | null; currency: string | null;
  rating: number | null; in_stock: number | null;
};

export function canonical(f: Fields): string {
  return JSON.stringify({
    currency: f.currency,
    in_stock: f.in_stock,
    price: f.price === null ? null : Number(f.price).toFixed(2),
    rating: f.rating,
    title: f.title,
  });
}
