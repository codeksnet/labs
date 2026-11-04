-- Scraper + data-quality demo. Written by the scraper worker and the correction tool with a
-- server-side key (service role / direct DB URL). RLS is on with no policies: anon/authenticated see nothing.
create schema if not exists data;

create table data.scrape_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  cursor text,                          -- next listing URL to fetch: the resume checkpoint
  pages int not null default 0,
  products int not null default 0,
  errors jsonb not null default '[]'
);

create table data.raw_snapshots (
  id bigint generated always as identity primary key,
  run_id bigint references data.scrape_runs(id) on delete set null,
  url text not null,
  fetched_at timestamptz not null default now(),
  status_code int,
  content_hash text not null,
  html text not null,
  unique (url, content_hash)            -- identical page content is stored once
);

create table data.entities (
  id bigint generated always as identity primary key,
  source text not null,
  source_key text not null,             -- natural key (UPC); the dedup key
  url text not null,
  title text,
  price numeric(10, 2),
  currency text,
  rating smallint,
  in_stock int,
  confidence real not null check (confidence between 0 and 1),
  confidence_reasons jsonb not null default '[]',
  needs_review boolean not null,
  corrected boolean not null default false,  -- a human fixed it: scrapes no longer overwrite fields
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_key)
);
create index on data.entities (needs_review, confidence);

create table data.entity_history (
  id bigint generated always as identity primary key,
  entity_id bigint not null references data.entities(id) on delete cascade,
  changed_at timestamptz not null default now(),
  reason text not null check (reason in ('scrape', 'correction')),
  changes jsonb not null,               -- {field: {old, new}}
  snapshot_id bigint references data.raw_snapshots(id) on delete set null
);
create index on data.entity_history (entity_id, changed_at desc);

-- A human correction becomes an eval case for codeks-evals: input is the page, expected is the fixed fields.
create table data.regression_cases (
  id bigint generated always as identity primary key,
  entity_id bigint not null references data.entities(id) on delete cascade,
  case_id text not null unique,
  input text not null,
  expected text not null,
  created_at timestamptz not null default now()
);

alter table data.scrape_runs enable row level security;
alter table data.raw_snapshots enable row level security;
alter table data.entities enable row level security;
alter table data.entity_history enable row level security;
alter table data.regression_cases enable row level security;
