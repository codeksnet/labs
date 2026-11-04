# Eval dashboard

Next.js dashboard for runs produced by [codeksnet/evals](https://github.com/codeksnet/evals): runs list and per-case drilldown, read from the `evals` schema in Supabase.

```sh
cp ../../.env.example .env.local   # set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY
pnpm --filter @codeksnet/evals-dashboard dev   # http://localhost:3001
```

Not built yet: runs-over-time chart, cost column. Deploy: Coolify with Dockerfile build arg `APP=evals-dashboard`.
