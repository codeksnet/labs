// Shared across Labs apps. PostHog init, Supabase client and UI kit land here.
export const DEMOS = [
  { slug: "evals", title: "Eval harness dashboard", subdomain: "evals.labs.codeks.net" },
  { slug: "tenants", title: "Tenant isolation", subdomain: "tenants.labs.codeks.net" },
  { slug: "events", title: "Events on AWS", subdomain: "events.labs.codeks.net" },
  { slug: "data", title: "Scraper + data quality", subdomain: "data.labs.codeks.net" },
  { slug: "imagegen", title: "Image generation (optional)", subdomain: "imagegen.labs.codeks.net" },
] as const;
