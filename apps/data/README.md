# Scraper + data quality

A resumable scraper, a schema that keeps history and confidence, and a correction tool that turns every human fix into an eval regression case.

```
Coolify cron ─▶ Playwright (optional residential proxy) ─▶ parse ─▶ normalise ─▶ score ─▶ Postgres (Supabase)
                  retry by failure type                                   │         raw_snapshots · entities · entity_history
                  checkpoint per listing page                             ▼
                                              low confidence ─▶ review queue (Next.js) ─ fix ─▶ regression_cases ─▶ codeks-evals
                                                                                                  Metabase on Coolify reads the same tables
```

**Source:** [books.toscrape.com](https://books.toscrape.com), a public sandbox built for scraping practice, so the demo has no terms-of-service or privacy problem. Swap the parser in `scraper/src/labs_scraper/parse.py` for a real source.

## Pieces

- `supabase/migrations/0001_data.sql`: `scrape_runs` (with the resume `cursor`), `raw_snapshots` (page HTML, deduped by content hash), `entities` (typed fields, `confidence`, `confidence_reasons`, `needs_review`, `corrected`), `entity_history` (per-field old/new), `regression_cases`. RLS on everywhere, no policies: only server-side keys reach it.
- `scraper/`: the worker.
  - **Retry by failure type** (`retry.py`): timeouts and network errors back off exponentially; 429 honours `Retry-After`; a block rotates the browser session once then gives up; 404 is never retried.
  - **Resumable** (`run.py`): the next listing URL is checkpointed after every page. A failed or bounded run resumes there instead of re-crawling.
  - **Normalise and dedup** (`normalize.py`): price and currency, rating words to numbers, stock counts; UPC is the dedup key, with a title hash as fallback.
  - **Confidence** (`confidence.py`): penalties per problem, including a cross-check of the listing page against the detail page. Below 0.8 goes to review.
  - **Corrections stick:** a corrected entity is not overwritten by later scrapes. What the scrape saw is logged in `entity_history` marked `ignored`, so a parser regression stays visible.
- `app/`: the Next.js review queue (port 3004). Saving a fix updates the row, writes history, and stores a regression case (page HTML in, corrected fields out). `/api/regressions` serves them as a `codeks-evals` JSONL eval set:
  ```sh
  curl localhost:3004/api/regressions > data-regressions.jsonl
  codeks-evals run data-regressions.jsonl --target labs_scraper.eval_target:parse_json
  ```
  A case fails until the parser produces the corrected values.
- `metabase/`: Compose file for Coolify, a read-only role, and five saved questions.

## Test

```sh
pnpm --filter @codeksnet/data test:scraper   # 28 tests; needs Docker for a throwaway Postgres
pnpm --filter @codeksnet/data test           # the TS canonical form matches the Python one
```

No network is used: fixtures are real saved pages from the sandbox, and a fake fetcher serves them.

## Run

1. Apply the migration in Supabase and add `data` to the exposed schemas (needed for the correction tool).
2. Scraper: `cd scraper && pip install -e . && playwright install chromium && DATABASE_URL=... python -m labs_scraper run --max-pages 2`.
3. Deploy: Coolify app from `scraper/Dockerfile` as a scheduled task (`0 3 * * *`), env from `.env.example`. A residential proxy is optional (`PROXY_URL`); the sandbox does not need one.
4. Correction tool: Coolify with the root Dockerfile, build arg `APP=data`, subdomain `data.labs.codeks.net`.
5. Metabase: Coolify Docker Compose from `metabase/docker-compose.yml`, then `metabase/readonly.sql`.

## Not done yet

A live deploy, the week-long unattended nightly run (the "done when" for this demo), and the Metabase dashboard itself. The Playwright fetcher was run once against the live sandbox (2 pages, 40 products, all parsed at confidence 1.0, then resumed from the checkpoint); retries, proxy rotation and the failure paths are only tested with a fake fetcher.
