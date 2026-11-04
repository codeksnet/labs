# Codeks Labs — Side Project & Open Source Plan

Source: Codeks Labs plan, Nov 4, 2026. Evenings and weekends, Nov 5 – Dec 20.

## Why
One open-source lab under Codeks: five small live demos and two blog posts, closing recurring gaps in AI evaluation, multi-tenant isolation, event-driven AWS, scraping/data quality and image generation. Left out on purpose: GraphQL, Django, mentoring evidence.

## Setup (Week 0, Nov 5–8)
- [ ] `codeksnet/labs` monorepo (this repo), pnpm + Turborepo
- [ ] `codeksnet/evals` repo (separate, pip-installable, MIT)
- [ ] Coolify: one project per app, auto-deploy on push to `main`
- [ ] Cloudflare: `labs.codeks.net` landing + CNAMEs (evals, tenants, events, data, imagegen)
- [ ] Supabase project (one schema per app, RLS, pgvector)
- [ ] AWS account + $10 billing alarm, Pulumi, Langfuse accounts
- [ ] `/blog` (MDX) on codeks.net

Already in place: Hetzner CX22 + Coolify, Cloudflare DNS, PostHog.

## Roadmap
| Window | Project | Subdomain | Done when |
|---|---|---|---|
| Nov 9–15 | Eval harness | evals. | Dashboard live, CI gate green |
| Nov 16–22 | Tenant isolation | tenants. | Tenant-switch toggle live, leak test visible in CI |
| Nov 22 | Post 1: how our evals missed a cross-tenant leak | | |
| Nov 23–29 | Events on AWS (Pulumi) | events. | `pulumi up` from scratch, live demo |
| Nov 29 | Post 2: tenant isolation for LLM features; **checkpoint 1** (CV + site) | | |
| Nov 30–Dec 13 | Scraper + data quality | data. | Nightly run unattended for a week, dashboard live |
| Dec 13 | **Checkpoint 2** (CV + site, usage numbers, decide imagegen) | | |
| Dec 14–20 | Imagegen (optional) | imagegen. | Live endpoint, spend cap enforced |

### Project specs
- **Eval harness** — Python package: JSONL eval sets, exact-match / schema / LLM-judge scoring, results to Supabase, Langfuse trace per run, GitHub Action fails PR on pass-rate drop; Next.js dashboard (runs over time, per-case drilldown, cost + latency). Target: ResumeMaster suggestion prompt, ~30 synthetic cases.
- **Tenant isolation** — Two fake tenants, RLS on every table, tenant-scoped pgvector retrieval for a small RAG feature; pytest leak test logs in as tenant A and asserts zero rows/chunks from B; wired into the eval gate.
- **Events on AWS** — EventBridge → SQS → Lambda workers with DLQ, S3 artifacts, all Pulumi (TS). Flow: reservation.created → schedule cleaning → send confirmation → generate owner statement. Thin Next.js front emits events and shows the trail; Grafana Cloud dashboard for queue depth/failures.
- **Scraper + data quality** — Python Coolify cron container; Playwright behind pay-as-you-go residential proxy; retry by failure type, resumable checkpoints. Supabase tables `raw_snapshots`, `entities`, `entity_history` with confidence columns; normalization, dedup, low-confidence flagging. Next.js correction tool where a fixed row becomes an eval regression case; Metabase on Coolify.
- **Imagegen (optional)** — FastAPI calling Fal (ControlNet + IP-Adapter), rate limit + daily spend cap, results to S3, minimal upload-and-preview front.

## Open source rules
- Public under github.com/codeksnet, Fortan as visible author; "Maintained by Fortan Pireva" in every README; blog posts linked from each repo.
- `.env.example` only; secrets in Coolify; GitHub secret scanning + gitleaks pre-commit.
- Eval sets synthetic or anonymized — nothing from Genpact clients or ResumeMaster users.
- Tenant demo seed data is fake; imagegen has a rate limit and daily spend cap.
- CONTRIBUTING.md and issues enabled on both repos.

## Working rules
- One PR per feature; every PR runs the eval gate from Week 1.
- Tailwind defaults, no custom design; done = live link + README diagram + PostHog event.
- One PostHog event per demo; put usage numbers in READMEs after a month.
- Codeks hosts demos and posts; fortanpireva.com and the CV only link to labs.codeks.net.
- No Genpact/ResumeMaster material anywhere. Drop imagegen if Weeks 4–5 run long.

## Blog posts (codeks.net/blog)
Incident pattern and fix only — no Genpact code, data, client names or internals.
1. *How our evals missed a cross-tenant data leak* (Week 2)
2. *Tenant isolation for LLM features: RLS, scoped retrieval and a leak test* (Week 3)

## Costs
~€5–6/month fixed (Hetzner); everything else on free tiers. One-off: ~€5–10 proxy, a few € Fal credits, cents per eval run (Haiku/mini-class models).
