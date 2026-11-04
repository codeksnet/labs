-- Run once in the Supabase SQL editor. Replace the password, then add a Metabase "PostgreSQL" connection
-- (use the Supabase pooler host) with user metabase_ro.
create role metabase_ro login password 'CHANGE_ME';
grant usage on schema data to metabase_ro;
grant select on data.scrape_runs, data.entities, data.entity_history, data.regression_cases to metabase_ro;
-- raw_snapshots (full HTML) is deliberately not granted.
-- RLS is enabled with no policies, so give this role a read policy on each table:
create policy metabase_read on data.scrape_runs for select to metabase_ro using (true);
create policy metabase_read on data.entities for select to metabase_ro using (true);
create policy metabase_read on data.entity_history for select to metabase_ro using (true);
create policy metabase_read on data.regression_cases for select to metabase_ro using (true);
