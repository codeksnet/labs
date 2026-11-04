-- Minimal stand-ins for the Supabase pieces the migration relies on, so the leak test runs
-- against plain Postgres + pgvector (local Docker and CI). NOT applied to real Supabase.
create schema if not exists extensions;
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         current_setting('request.jwt.claims', true)::json ->> 'sub'), '')::uuid
$$;
-- Supabase grants this by default; the operators/types live here.
grant usage on schema extensions to anon, authenticated;
