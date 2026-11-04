# Events on AWS

Event-driven, serverless AWS defined entirely in Pulumi (TypeScript). A thin Next.js front emits `reservation.created` and shows what each worker did.

```
Next.js front ─ PutEvents ─▶ EventBridge bus ─ rule ─┬▶ SQS cleaning ──▶ Lambda ─┐
 (scoped IAM user)                                   ├▶ SQS confirmation ▶ Lambda ├▶ DynamoDB trail ─▶ front (polls)
                                                     └▶ SQS statement ──▶ Lambda ─┴▶ S3 owner statement
                                  each queue ─ 3 failed receives ─▶ its own DLQ
```

- `infra/index.ts`: the whole stack. `pulumi up` from scratch builds it; `pulumi destroy` removes it.
- `infra/handlers/`: the workers. One esbuild bundle, three Lambdas, selected by the `STAGE` env var. Partial batch responses (only the failed record retries), idempotent writes (a redelivery overwrites the same trail key and S3 key).
- `lib/contract.ts`: the event shape, shared by workers and front.
- Cost guards: worker concurrency capped at 2, trail rows expire after 24h, statements after 7 days, a monthly budget alarm when `alertEmail` is set, and a per-process emit rate limit in the front. All fake data.
- The front gets its own IAM user that can only `events:PutEvents` on the bus and `dynamodb:Query` the trail.

## Test without AWS

```sh
pnpm --filter @codeksnet/events-infra test
```

Worker logic is tested with injected dependencies; the Pulumi program is tested with mocks (DLQ redrive, least-privilege IAM, private bucket, rule pattern). Nothing here calls AWS.

## Deploy (needs your AWS account)

```sh
cd apps/events/infra
pulumi login && pulumi stack init dev
pulumi config set codeks-labs-events:alertEmail you@example.com   # $10 budget alarm
pnpm up                                                           # builds handlers, then pulumi up
pulumi stack output frontAccessKeyId; pulumi stack output frontSecretAccessKey --show-secrets
```

Front env (Coolify): `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EVENT_BUS_NAME`, `TRAIL_TABLE` (from the stack outputs). Dockerfile build arg `APP=events`, subdomain `events.labs.codeks.net`.

## Not done yet

Grafana Cloud dashboard (queue depth and DLQ failures), and a live deploy. The stack has not been applied to a real account.
