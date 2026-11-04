# Codeks Labs

Five small live demos, open source. Each one closes a gap that keeps showing up in real engineering work: AI evaluation, multi-tenant isolation, event-driven AWS, scraping with data quality, and image generation.

Live at **[labs.codeks.net](https://labs.codeks.net)** · Blog at [codeks.net/blog](https://codeks.net/blog)

| Demo | App | Stack | Status |
|---|---|---|---|
| Eval harness dashboard | `apps/evals-dashboard` | Next.js, Supabase, Langfuse | In progress (runs list + drilldown scaffolded) |
| Tenant isolation | `apps/tenants` | Next.js, Supabase RLS, pgvector, pytest | In progress (schema, RLS, leak test, app scaffolded) |
| Events on AWS | `apps/events` | Pulumi (TS), Lambda, SQS, EventBridge, S3 | In progress (stack + workers tested with mocks; not yet deployed) |
| Scraper + data quality | `apps/data` | Python, Playwright, Supabase, Metabase | In progress (scraper, schema, review tool tested on fixtures; not yet run live) |
| Image generation (optional) | `apps/imagegen` | FastAPI, Fal, S3 | Planned (Dec 14–20) |

The eval harness itself is a separate pip-installable package: [`codeksnet/evals`](https://github.com/codeksnet/evals). Every demo here depends on it.

## Layout

```
apps/        one directory per demo (landing page lives in apps/landing)
packages/    shared code (@codeksnet/shared: PostHog, Supabase client, UI kit)
docs/        plan and architecture notes
```

pnpm + Turborepo monorepo.

```sh
pnpm install
pnpm dev        # landing :3000, evals dashboard :3001
pnpm typecheck && pnpm build
```

Deploying: one Coolify app per directory in `apps/`, using the root `Dockerfile` with build arg `APP=<dir>`.

## Ground rules

- Secrets never go in the repo: `.env.example` only, real values live in Coolify. Gitleaks runs in pre-commit and CI.
- All data is synthetic or anonymized. Nothing from client work or real users.
- A demo is done when it has a live link, a README with one architecture diagram, and a PostHog event firing.

See [docs/PLAN.md](docs/PLAN.md) for the full roadmap and [CONTRIBUTING.md](CONTRIBUTING.md) to get involved.

Maintained by [Fortan Pireva](https://github.com/FortanPireva) at [Codeks](https://codeks.net). MIT licensed.
