export const DEMOS = [
  { slug: "evals", title: "Eval harness", blurb: "JSONL eval sets, LLM-judge scoring, a CI gate on pass rate, and a dashboard of runs over time.", url: "https://evals.labs.codeks.net", repo: "https://github.com/codeksnet/evals", status: "building" },
  { slug: "tenants", title: "Tenant isolation", blurb: "Postgres RLS and tenant-scoped pgvector retrieval, with a leak test that runs on every PR.", url: "https://tenants.labs.codeks.net", repo: "https://github.com/codeksnet/labs/tree/main/apps/tenants", status: "building" },
  { slug: "events", title: "Events on AWS", blurb: "EventBridge to SQS to Lambda with a DLQ, all in Pulumi. One command from nothing to running.", url: "https://events.labs.codeks.net", repo: "https://github.com/codeksnet/labs/tree/main/apps/events", status: "planned" },
  { slug: "data", title: "Scraper + data quality", blurb: "Resumable Playwright scraping, confidence scoring, and a correction tool that feeds the evals.", url: "https://data.labs.codeks.net", repo: "https://github.com/codeksnet/labs/tree/main/apps/data", status: "planned" },
  { slug: "imagegen", title: "Image generation", blurb: "Fal endpoint with a rate limit and a daily spend cap. Optional.", url: "https://imagegen.labs.codeks.net", repo: "https://github.com/codeksnet/labs/tree/main/apps/imagegen", status: "planned" },
] as const;

export type Demo = (typeof DEMOS)[number];
