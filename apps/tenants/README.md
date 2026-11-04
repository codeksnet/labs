# Tenant isolation

Two fake tenants (Acme Cleaning, Globex Property Mgmt) in one Postgres database, with a small RAG search over their documents. Isolation is enforced by row-level security, so a bug in the app or a clever prompt cannot cross tenants.

```
browser ─ toggle tenant ─▶ Next.js (server) ─ signs in as that tenant's user ─▶ Supabase
                                                                                  │
                    select / match_chunks (pgvector, SECURITY INVOKER) ─▶ RLS: is_member(tenant_id)
```

- `supabase/migrations/0001_tenants.sql`: tables, composite FK (a chunk can only reference a document of its own tenant), RLS on every table, and `match_chunks`, which takes no tenant argument on purpose.
- `tests/`: the leak test. Logs in as tenant A and asserts zero rows or chunks from B through plain selects, vector search with B's exact embedding, writes, updates and deletes. Also asserts every table has RLS on.
- `lib/embed.ts`: keyless hashing embedding (64 dims) so the demo needs no API key. Swap for a real model and change the vector size in the migration.

## Run the leak test (no accounts needed)

```sh
pnpm --filter @codeksnet/tenants test:leak   # needs Docker; starts a throwaway pgvector Postgres
```

CI runs the same test on every PR against a pgvector service container (`supabase/ci/00_auth_stub.sql` stands in for Supabase's `auth` schema and roles).

## Run the app

1. Supabase project: apply `supabase/migrations/0001_tenants.sql`, add `tenants` to the exposed schemas (Settings, API).
2. `.env.local` in this directory: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `DEMO_PASSWORD` (any password; the two demo users are fake).
3. `pnpm --filter @codeksnet/tenants seed`, then `pnpm --filter @codeksnet/tenants dev` (port 3002).

All data is fictional. Deploy: Coolify with Dockerfile build arg `APP=tenants`, subdomain `tenants.labs.codeks.net`.

Related post (coming): how our evals missed a cross-tenant data leak.
